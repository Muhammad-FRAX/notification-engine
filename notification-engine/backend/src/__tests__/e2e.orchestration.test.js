/**
 * Phase 16 — End-to-end orchestration tests
 *
 * Each test exercises a complete QA scenario through processNotification (the
 * top-level orchestrator) with mocks only at the outermost integration
 * boundaries (Graph API calls and repository I/O).  The full service stack
 * runs unmodified: routing → audience → template → audit → graph.
 *
 * Scenarios covered (mirrors qa/qa-script.sh):
 *   1.  Simple routing — one rule, one user
 *   2.  Multi-group fan-out — two rules, different groups
 *   3.  Recipient de-dup — same recipient in two groups receives only one delivery
 *   4.  Image composition — hostedContents built from inbound attachment
 *   5.  Adaptive card — htmlBody wrapped in <attachment>, card in attachments[]
 *   6.  Template validation failure — delivery marked failed, processing continues
 *   7.  Retryable 429 from Graph — delivery put to 'retrying'
 *   8.  Manual retry — retryNotificationDeliveries resets failed deliveries
 *   9.  Audit detail — getNotificationDetail returns notification + deliveries
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock only at the DB / Graph boundary
vi.mock('../repositories/rules.repo.js', () => ({ listActiveBySource: vi.fn() }));
vi.mock('../repositories/groups.repo.js', () => ({ listMembers: vi.fn() }));
vi.mock('../repositories/recipients.repo.js', () => ({
  findUserById: vi.fn(),
  findChannelById: vi.fn(),
}));
vi.mock('../repositories/templates.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../repositories/proxyAccount.repo.js', () => ({ getProxyAccount: vi.fn() }));
vi.mock('../repositories/notifications.repo.js', () => ({
  create: vi.fn(),
  update: vi.fn(),
  findById: vi.fn(),
  listNotifications: vi.fn(),
  getStats: vi.fn(),
}));
vi.mock('../repositories/deliveries.repo.js', () => ({
  create: vi.fn(),
  markSent: vi.fn(),
  markFailed: vi.fn(),
  markRetrying: vi.fn(),
  listByNotification: vi.fn(),
  findById: vi.fn(),
  resetForRetry: vi.fn(),
}));
vi.mock('../integrations/graph.service.js', () => ({
  createOneOnOneChat: vi.fn(),
  sendChatMessage: vi.fn(),
  sendChannelMessage: vi.fn(),
}));

// Import after mocks
import { listActiveBySource } from '../repositories/rules.repo.js';
import { listMembers } from '../repositories/groups.repo.js';
import { findUserById, findChannelById } from '../repositories/recipients.repo.js';
import { findById as findTemplate } from '../repositories/templates.repo.js';
import { getProxyAccount } from '../repositories/proxyAccount.repo.js';
import * as notificationsRepo from '../repositories/notifications.repo.js';
import * as deliveriesRepo from '../repositories/deliveries.repo.js';
import { createOneOnOneChat, sendChatMessage, sendChannelMessage } from '../integrations/graph.service.js';

import { processNotification } from '../services/notification.service.js';
import {
  getNotificationDetail,
  retryNotificationDeliveries,
  retryOneDelivery,
} from '../services/audit.service.js';
import { HttpError } from '../util/HttpError.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const PROXY = { aad_user_id: 'proxy-oid', status: 'signed_in' };

const ALICE = { id: 'usr_alice', upn: 'alice@example.com', aad_user_id: null };
const BOB   = { id: 'usr_bob',   upn: 'bob@example.com',   aad_user_id: 'bob-entra-oid' };
const CHAN  = { id: 'chn_ops',   team_id: 'team-1',        channel_id: 'chan-1' };

const TPL_TEXT = {
  id: 'tpl_text',
  kind: 'text_html',
  body: '<p>{{title}}</p><p>{{body}}</p>',
  vars_schema: null,
};

const TPL_CARD = {
  id: 'tpl_card',
  kind: 'adaptive_card',
  body: '{"type":"AdaptiveCard","version":"1.4","body":[{"type":"TextBlock","text":"{{title}}"}]}',
  vars_schema: null,
};

const TPL_STRICT = {
  id: 'tpl_strict',
  kind: 'text_html',
  body: 'KPI: {{data.kpi}}',
  vars_schema: { required: ['data.kpi'] },
};

const RULE_A = { id: 'rul_A', group_id: 'grp_A', template_id: 'tpl_text',   priority: 100, event_pattern: 'alarm.*' };
const RULE_B = { id: 'rul_B', group_id: 'grp_B', template_id: 'tpl_card',   priority: 200, event_pattern: 'alarm.*' };
const RULE_C = { id: 'rul_C', group_id: 'grp_A', template_id: 'tpl_strict', priority: 100, event_pattern: 'kpi.*' };

// GroupA: alice only
// GroupB: alice + bob + channel (alice duplicates with GroupA → de-dup target)
const MEMBERS_A = [{ member_type: 'user',    member_id: 'usr_alice' }];
const MEMBERS_B = [
  { member_type: 'user',    member_id: 'usr_alice' },
  { member_type: 'user',    member_id: 'usr_bob'   },
  { member_type: 'channel', member_id: 'chn_ops'   },
];

// Delivery counter for unique ids
let _dlvCounter = 0;
const nextDlv = () => ({ id: `dlv_${++_dlvCounter}`, notification_id: 'ntf_qa' });

let _ntfCounter = 0;
const nextNtf = () => ({ id: `ntf_${++_ntfCounter}`, status: 'queued' });

beforeEach(() => {
  vi.clearAllMocks();

  // Default happy-path stubs (overridden per scenario)
  getProxyAccount.mockResolvedValue(PROXY);
  findTemplate.mockImplementation(async (id) => {
    if (id === 'tpl_text')   return TPL_TEXT;
    if (id === 'tpl_card')   return TPL_CARD;
    if (id === 'tpl_strict') return TPL_STRICT;
    return null;
  });
  findUserById.mockImplementation(async (id) => {
    if (id === 'usr_alice') return ALICE;
    if (id === 'usr_bob')   return BOB;
    return null;
  });
  findChannelById.mockImplementation(async (id) => {
    if (id === 'chn_ops') return CHAN;
    return null;
  });
  notificationsRepo.create.mockImplementation(async () => nextNtf());
  notificationsRepo.update.mockResolvedValue({});
  deliveriesRepo.create.mockImplementation(async () => nextDlv());
  deliveriesRepo.markSent.mockResolvedValue({});
  deliveriesRepo.markFailed.mockResolvedValue({});
  deliveriesRepo.markRetrying.mockResolvedValue({});
  deliveriesRepo.listByNotification.mockResolvedValue([]);

  createOneOnOneChat.mockResolvedValue('chat-id');
  sendChatMessage.mockResolvedValue({ id: 'msg-1' });
  sendChannelMessage.mockResolvedValue({ id: 'msg-2' });
});

// ---------------------------------------------------------------------------
// 1. Simple routing — one rule, one user recipient
// ---------------------------------------------------------------------------
describe('Scenario 1 — simple routing', () => {
  it('matches one rule and delivers to alice', async () => {
    listActiveBySource.mockResolvedValue([RULE_A]);
    listMembers.mockResolvedValue(MEMBERS_A);
    deliveriesRepo.listByNotification.mockResolvedValue([{ status: 'sent' }]);

    const result = await processNotification('src_1', 'alarm.test', { title: 'Alert', body: 'Down' });

    expect(result.matchedGroups).toEqual(['grp_A']);
    expect(result.queuedDeliveries).toBe(1);
    expect(createOneOnOneChat).toHaveBeenCalledWith('proxy-oid', 'alice@example.com');
    expect(sendChatMessage).toHaveBeenCalledWith(
      'chat-id',
      '<p>Alert</p><p>Down</p>',
      expect.any(Object),
    );
    expect(deliveriesRepo.markSent).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// 2. Multi-group fan-out — two rules fire for same event
// ---------------------------------------------------------------------------
describe('Scenario 2 — multi-group fan-out', () => {
  it('fires both rules and reports two matched groups', async () => {
    listActiveBySource.mockResolvedValue([RULE_A, RULE_B]);
    listMembers.mockImplementation(async (gid) =>
      gid === 'grp_A' ? MEMBERS_A : MEMBERS_B,
    );
    deliveriesRepo.listByNotification.mockResolvedValue([
      { status: 'sent' }, { status: 'sent' }, { status: 'sent' },
    ]);

    const result = await processNotification('src_1', 'alarm.fanout', { title: 'Fan-out', body: 'Both groups' });

    // grp_A + grp_B both in matchedGroups
    expect(result.matchedGroups).toContain('grp_A');
    expect(result.matchedGroups).toContain('grp_B');
    expect(result.matchedGroups).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 3. Recipient de-dup — alice appears in both groups; she receives only one delivery
// ---------------------------------------------------------------------------
describe('Scenario 3 — recipient de-dup', () => {
  it('sends only one delivery to alice even when she is in both groups', async () => {
    listActiveBySource.mockResolvedValue([RULE_A, RULE_B]);
    listMembers.mockImplementation(async (gid) =>
      gid === 'grp_A' ? MEMBERS_A : MEMBERS_B,
    );
    deliveriesRepo.listByNotification.mockResolvedValue([
      { status: 'sent' }, { status: 'sent' }, { status: 'sent' },
    ]);

    const result = await processNotification('src_1', 'alarm.dedup', { title: 'Dedup', body: '' });

    // GroupA: alice (1)
    // GroupB: alice (deduped), bob (1), channel (1)
    // Total unique: 3
    expect(result.queuedDeliveries).toBe(3);
    expect(deliveriesRepo.create).toHaveBeenCalledTimes(3);

    // Alice's createOneOnOneChat called exactly once
    const chatCalls = createOneOnOneChat.mock.calls;
    const aliceCalls = chatCalls.filter((c) => c[1] === 'alice@example.com');
    expect(aliceCalls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 4. Image composition — inbound attachment becomes hostedContent + <img> tag
// ---------------------------------------------------------------------------
describe('Scenario 4 — image composition', () => {
  it('composes hostedContents and appends <img> tag to htmlBody', async () => {
    listActiveBySource.mockResolvedValue([RULE_A]);
    listMembers.mockResolvedValue(MEMBERS_A);
    deliveriesRepo.listByNotification.mockResolvedValue([{ status: 'sent' }]);

    const payload = {
      title: 'Chart',
      body: 'See chart',
      attachments: [{ kind: 'image', filename: 'chart.png', base64: 'abc123==', mimeType: 'image/png' }],
    };

    await processNotification('src_1', 'alarm.image', payload);

    const [, htmlBody, opts] = sendChatMessage.mock.calls[0];
    expect(htmlBody).toContain('<img src="../hostedContents/1/$value"');
    expect(opts.hostedContents).toHaveLength(1);
    expect(opts.hostedContents[0]).toMatchObject({ tempId: '1', base64: 'abc123==', mimeType: 'image/png' });
    expect(opts.hostedContents[0].base64).toBe('abc123==');
  });
});

// ---------------------------------------------------------------------------
// 5. Adaptive card rendering
// ---------------------------------------------------------------------------
describe('Scenario 5 — adaptive card', () => {
  it('wraps card in <attachment> and passes card JSON in attachments[]', async () => {
    listActiveBySource.mockResolvedValue([RULE_B]);
    listMembers.mockResolvedValue([{ member_type: 'user', member_id: 'usr_alice' }]);
    deliveriesRepo.listByNotification.mockResolvedValue([{ status: 'sent' }]);

    await processNotification('src_1', 'alarm.card', { title: 'KPI Alert', body: '' });

    const [, htmlBody, opts] = sendChatMessage.mock.calls[0];
    expect(htmlBody).toBe('<attachment id="1"></attachment>');
    expect(opts.attachments).toHaveLength(1);
    expect(opts.attachments[0].contentType).toBe('application/vnd.microsoft.card.adaptive');
    expect(opts.attachments[0].content).toContain('KPI Alert');
  });
});

// ---------------------------------------------------------------------------
// 6. Template validation failure — delivery marked failed, processing continues
// ---------------------------------------------------------------------------
describe('Scenario 6 — template validation failure', () => {
  it('marks delivery failed with template_validation reason and keeps notification alive', async () => {
    listActiveBySource.mockResolvedValue([RULE_C]);
    listMembers.mockResolvedValue(MEMBERS_A);
    deliveriesRepo.listByNotification.mockResolvedValue([{ status: 'failed' }]);

    // Missing data.kpi — strict template will throw
    const result = await processNotification('src_1', 'kpi.degraded', { title: 'KPI alert' });

    expect(result.notificationId).toBeDefined();
    // No sends attempted
    expect(sendChatMessage).not.toHaveBeenCalled();
    // Delivery was created and marked failed
    expect(deliveriesRepo.create).toHaveBeenCalledOnce();
    expect(deliveriesRepo.markFailed).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('template_validation'),
    );
  });

  it('continues to next rule after one rule fails validation', async () => {
    // RULE_C (strict, grp_A → alice) fails; RULE_D (default template, grp_B → alice+bob+channel) runs next.
    // Alice was added to seenRecipients during the RULE_C failure path, so she is de-duped in RULE_D.
    // Bob and the channel from grp_B are new → they receive deliveries.
    const RULE_D = { id: 'rul_D', group_id: 'grp_B', template_id: null, priority: 200, event_pattern: 'kpi.*' };
    listActiveBySource.mockResolvedValue([RULE_C, RULE_D]);
    listMembers.mockImplementation(async (gid) =>
      gid === 'grp_A' ? MEMBERS_A : MEMBERS_B,
    );
    deliveriesRepo.listByNotification.mockResolvedValue([
      { status: 'failed' }, { status: 'sent' }, { status: 'sent' },
    ]);

    const result = await processNotification('src_1', 'kpi.degraded', { title: 'KPI alert' });

    // grp_B added to matchedGroups (rule D rendered ok); grp_A not (rule C threw)
    expect(result.matchedGroups).toContain('grp_B');
    expect(result.matchedGroups).not.toContain('grp_A');

    // alice deduped (already in seenRecipients from rule C); bob + channel are new
    expect(sendChatMessage).toHaveBeenCalledTimes(1);    // bob
    expect(sendChannelMessage).toHaveBeenCalledTimes(1); // ops-channel

    // seenRecipients: alice (failed) + bob + channel = 3
    expect(result.queuedDeliveries).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 7. Retryable 429 from Graph → delivery put to 'retrying'
// ---------------------------------------------------------------------------
describe('Scenario 7 — 429 retry classification', () => {
  it('marks delivery as retrying when Graph returns 429', async () => {
    listActiveBySource.mockResolvedValue([RULE_A]);
    listMembers.mockResolvedValue(MEMBERS_A);
    deliveriesRepo.listByNotification.mockResolvedValue([{ status: 'retrying' }]);
    const throttleErr = Object.assign(new Error('Too Many Requests'), { statusCode: 429 });
    sendChatMessage.mockRejectedValue(throttleErr);

    await processNotification('src_1', 'alarm.throttle', { title: 'Throttle test', body: '' });

    expect(deliveriesRepo.markRetrying).toHaveBeenCalledOnce();
    expect(deliveriesRepo.markFailed).not.toHaveBeenCalled();
  });

  it('marks delivery as retrying for 5xx Graph errors', async () => {
    listActiveBySource.mockResolvedValue([RULE_A]);
    listMembers.mockResolvedValue(MEMBERS_A);
    deliveriesRepo.listByNotification.mockResolvedValue([{ status: 'retrying' }]);
    const serverErr = Object.assign(new Error('Internal Server Error'), { statusCode: 503 });
    sendChatMessage.mockRejectedValue(serverErr);

    await processNotification('src_1', 'alarm.5xx', { title: '5xx test', body: '' });

    expect(deliveriesRepo.markRetrying).toHaveBeenCalledOnce();
    expect(deliveriesRepo.markFailed).not.toHaveBeenCalled();
  });

  it('marks delivery failed for non-retryable 403', async () => {
    listActiveBySource.mockResolvedValue([RULE_A]);
    listMembers.mockResolvedValue(MEMBERS_A);
    deliveriesRepo.listByNotification.mockResolvedValue([{ status: 'failed' }]);
    const forbiddenErr = Object.assign(new Error('Forbidden'), { statusCode: 403 });
    sendChatMessage.mockRejectedValue(forbiddenErr);

    await processNotification('src_1', 'alarm.403', { title: '403 test', body: '' });

    expect(deliveriesRepo.markFailed).toHaveBeenCalledOnce();
    expect(deliveriesRepo.markRetrying).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 8. Manual retry flow
// ---------------------------------------------------------------------------
describe('Scenario 8 — manual retry', () => {
  describe('retryNotificationDeliveries (bulk)', () => {
    it('resets all failed deliveries and returns queued count', async () => {
      const NTF = { id: 'ntf_q1' };
      const DLVS = [
        { id: 'dlv_1', status: 'failed' },
        { id: 'dlv_2', status: 'sent'   },
        { id: 'dlv_3', status: 'failed' },
      ];
      notificationsRepo.findById.mockResolvedValue(NTF);
      deliveriesRepo.listByNotification.mockResolvedValue(DLVS);
      deliveriesRepo.resetForRetry.mockResolvedValue({ id: 'dlv_1', status: 'retrying', attempts: 0 });
      notificationsRepo.update.mockResolvedValue({});

      const result = await retryNotificationDeliveries('ntf_q1');

      expect(result.queued).toBe(2);
      expect(deliveriesRepo.resetForRetry).toHaveBeenCalledTimes(2);
      expect(deliveriesRepo.resetForRetry).toHaveBeenCalledWith('dlv_1');
      expect(deliveriesRepo.resetForRetry).toHaveBeenCalledWith('dlv_3');
    });

    it('returns null when notification not found', async () => {
      notificationsRepo.findById.mockResolvedValue(null);
      expect(await retryNotificationDeliveries('ntf_missing')).toBeNull();
    });

    it('returns queued:0 and does not call resetForRetry when nothing is failed', async () => {
      notificationsRepo.findById.mockResolvedValue({ id: 'ntf_q2' });
      deliveriesRepo.listByNotification.mockResolvedValue([{ id: 'dlv_x', status: 'sent' }]);

      const result = await retryNotificationDeliveries('ntf_q2');
      expect(result.queued).toBe(0);
      expect(deliveriesRepo.resetForRetry).not.toHaveBeenCalled();
    });
  });

  describe('retryOneDelivery (single)', () => {
    it('resets a failed delivery to retrying with attempts=0', async () => {
      const DELIVERY = { id: 'dlv_f1', status: 'failed', notification_id: 'ntf_r1' };
      const RESET = { id: 'dlv_f1', status: 'retrying', attempts: 0 };
      deliveriesRepo.findById.mockResolvedValue(DELIVERY);
      deliveriesRepo.resetForRetry.mockResolvedValue(RESET);
      deliveriesRepo.listByNotification.mockResolvedValue([RESET]);
      notificationsRepo.update.mockResolvedValue({});

      const result = await retryOneDelivery('dlv_f1');
      expect(result.status).toBe('retrying');
      expect(result.attempts).toBe(0);
    });

    it('throws 409 when delivery is not in failed state', async () => {
      deliveriesRepo.findById.mockResolvedValue({ id: 'dlv_s', status: 'sent', notification_id: 'ntf_x' });
      const err = await retryOneDelivery('dlv_s').catch((e) => e);
      expect(err).toBeInstanceOf(HttpError);
      expect(err.status).toBe(409);
      expect(err.code).toBe('not_retryable');
    });

    it('returns null when delivery not found', async () => {
      deliveriesRepo.findById.mockResolvedValue(null);
      expect(await retryOneDelivery('dlv_gone')).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// 9. Audit detail — getNotificationDetail returns notification + deliveries
// ---------------------------------------------------------------------------
describe('Scenario 9 — audit detail', () => {
  it('returns the notification merged with its delivery rows', async () => {
    const NOTIF = { id: 'ntf_audit', event_type: 'alarm.test', status: 'partial' };
    const DLVS = [
      { id: 'dlv_1', status: 'sent',   recipient_type: 'user' },
      { id: 'dlv_2', status: 'failed', recipient_type: 'user', last_error: 'Graph 403' },
    ];
    notificationsRepo.findById.mockResolvedValue(NOTIF);
    deliveriesRepo.listByNotification.mockResolvedValue(DLVS);

    const detail = await getNotificationDetail('ntf_audit');

    expect(detail.id).toBe('ntf_audit');
    expect(detail.event_type).toBe('alarm.test');
    expect(detail.status).toBe('partial');
    expect(detail.deliveries).toHaveLength(2);
    expect(detail.deliveries[0].status).toBe('sent');
    expect(detail.deliveries[1].last_error).toBe('Graph 403');
  });

  it('returns null when the notification does not exist', async () => {
    notificationsRepo.findById.mockResolvedValue(null);
    const detail = await getNotificationDetail('ntf_nope');
    expect(detail).toBeNull();
    expect(deliveriesRepo.listByNotification).not.toHaveBeenCalled();
  });

  it('does not call listByNotification when notification is missing', async () => {
    notificationsRepo.findById.mockResolvedValue(null);
    await getNotificationDetail('ntf_gone');
    expect(deliveriesRepo.listByNotification).not.toHaveBeenCalled();
  });
});
