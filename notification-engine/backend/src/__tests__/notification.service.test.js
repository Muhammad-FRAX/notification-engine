import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/routing.service.js', () => ({
  resolveRules: vi.fn(),
}));

vi.mock('../services/audience.service.js', () => ({
  expandGroup: vi.fn(),
}));

vi.mock('../services/template.service.js', () => ({
  getEffectiveTemplate: vi.fn(),
  renderTemplate: vi.fn(),
}));

vi.mock('../services/audit.service.js', () => ({
  createNotification: vi.fn(),
  updateNotification: vi.fn(),
  createDelivery: vi.fn(),
  markDeliverySent: vi.fn(),
  markDeliveryFailed: vi.fn(),
  markDeliveryRetrying: vi.fn(),
  computeAndUpdateNotificationStatus: vi.fn(),
}));

vi.mock('../integrations/graph.service.js', () => ({
  createOneOnOneChat: vi.fn(),
  sendChatMessage: vi.fn(),
  sendChannelMessage: vi.fn(),
}));

vi.mock('../repositories/proxyAccount.repo.js', () => ({
  getProxyAccount: vi.fn(),
}));

import { resolveRules } from '../services/routing.service.js';
import { expandGroup } from '../services/audience.service.js';
import { getEffectiveTemplate, renderTemplate } from '../services/template.service.js';
import * as auditService from '../services/audit.service.js';
import { createOneOnOneChat, sendChatMessage, sendChannelMessage } from '../integrations/graph.service.js';
import { getProxyAccount } from '../repositories/proxyAccount.repo.js';
import { processNotification } from '../services/notification.service.js';

const NOTIFICATION = { id: 'ntf_1', status: 'queued' };
const PROXY = { aad_user_id: 'sender-oid', status: 'signed_in' };
const USER_ROW = { id: 'usr_1', upn: 'alice@example.com', aad_user_id: null };
const CHANNEL_ROW = { id: 'chn_1', team_id: 't1', channel_id: 'c1' };
const RULE = { id: 'rul_1', group_id: 'grp_1', template_id: 'tpl_1' };
const TEMPLATE = { id: 'tpl_1', kind: 'text_html', body: '{{title}}', vars_schema: null };
const RENDERED = { htmlBody: '<p>Alert</p>', attachments: [], hostedContents: [] };
const DELIVERY = { id: 'dlv_1' };

beforeEach(() => {
  vi.clearAllMocks();

  auditService.createNotification.mockResolvedValue(NOTIFICATION);
  auditService.updateNotification.mockResolvedValue({});
  auditService.createDelivery.mockResolvedValue(DELIVERY);
  auditService.markDeliverySent.mockResolvedValue({});
  auditService.markDeliveryFailed.mockResolvedValue({});
  auditService.markDeliveryRetrying.mockResolvedValue({});
  auditService.computeAndUpdateNotificationStatus.mockResolvedValue('sent');

  getProxyAccount.mockResolvedValue(PROXY);
  getEffectiveTemplate.mockResolvedValue(TEMPLATE);
  renderTemplate.mockReturnValue(RENDERED);

  createOneOnOneChat.mockResolvedValue('chat_abc');
  sendChatMessage.mockResolvedValue({ id: 'msg_1' });
  sendChannelMessage.mockResolvedValue({ id: 'msg_2' });
});

// ---------------------------------------------------------------------------
// Happy path — one rule, one user recipient
// ---------------------------------------------------------------------------

describe('processNotification — happy path', () => {
  it('resolves, renders, sends, and returns the notification summary', async () => {
    resolveRules.mockResolvedValue([RULE]);
    expandGroup.mockResolvedValue([{ type: 'user', id: 'usr_1', details: USER_ROW }]);

    const result = await processNotification('src_1', 'alarm', { title: 'Alert' });

    expect(result.notificationId).toBe('ntf_1');
    expect(result.matchedGroups).toContain('grp_1');
    expect(result.queuedDeliveries).toBe(1);

    expect(auditService.createNotification).toHaveBeenCalledOnce();
    expect(auditService.createDelivery).toHaveBeenCalledOnce();
    expect(createOneOnOneChat).toHaveBeenCalledWith('sender-oid', 'alice@example.com');
    expect(sendChatMessage).toHaveBeenCalledWith('chat_abc', '<p>Alert</p>', expect.any(Object));
    expect(auditService.markDeliverySent).toHaveBeenCalledWith('dlv_1', expect.objectContaining({ graphChatId: 'chat_abc' }));
  });

  it('uses aad_user_id in preference to upn when available', async () => {
    const userWithOid = { ...USER_ROW, aad_user_id: 'entra-oid-123' };
    resolveRules.mockResolvedValue([RULE]);
    expandGroup.mockResolvedValue([{ type: 'user', id: 'usr_1', details: userWithOid }]);

    await processNotification('src_1', 'alarm', {});

    expect(createOneOnOneChat).toHaveBeenCalledWith('sender-oid', 'entra-oid-123');
  });

  it('sends to a channel recipient via sendChannelMessage', async () => {
    resolveRules.mockResolvedValue([RULE]);
    expandGroup.mockResolvedValue([{ type: 'channel', id: 'chn_1', details: CHANNEL_ROW }]);

    await processNotification('src_1', 'alarm', {});

    expect(sendChannelMessage).toHaveBeenCalledWith('t1', 'c1', '<p>Alert</p>', expect.any(Object));
    expect(auditService.markDeliverySent).toHaveBeenCalledWith('dlv_1', expect.objectContaining({ graphChatId: null }));
  });

  it('de-duplicates recipients that appear in multiple rules', async () => {
    const rule2 = { id: 'rul_2', group_id: 'grp_2', template_id: 'tpl_1' };
    resolveRules.mockResolvedValue([RULE, rule2]);
    expandGroup.mockResolvedValue([{ type: 'user', id: 'usr_1', details: USER_ROW }]);

    const result = await processNotification('src_1', 'alarm', {});

    expect(result.queuedDeliveries).toBe(1);
    expect(auditService.createDelivery).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Unrouted — no rules match
// ---------------------------------------------------------------------------

describe('processNotification — unrouted', () => {
  it('marks notification as unrouted and returns empty groups', async () => {
    resolveRules.mockResolvedValue([]);

    const result = await processNotification('src_1', 'unknown.event', {});

    expect(result.matchedGroups).toEqual([]);
    expect(result.queuedDeliveries).toBe(0);
    expect(auditService.updateNotification).toHaveBeenCalledWith('ntf_1', { status: 'unrouted' });
    expect(auditService.createDelivery).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Template validation failure
// ---------------------------------------------------------------------------

describe('processNotification — template validation failure', () => {
  it('marks deliveries failed with template_validation and continues processing', async () => {
    const validErr = Object.assign(new Error('title missing'), { code: 'template_validation' });
    renderTemplate.mockImplementationOnce(() => { throw validErr; });

    resolveRules.mockResolvedValue([RULE]);
    expandGroup.mockResolvedValue([{ type: 'user', id: 'usr_1', details: USER_ROW }]);

    const result = await processNotification('src_1', 'alarm', {});

    expect(auditService.markDeliveryFailed).toHaveBeenCalledWith(
      'dlv_1',
      expect.stringContaining('template_validation'),
    );
    expect(sendChatMessage).not.toHaveBeenCalled();
    expect(result.notificationId).toBe('ntf_1');
  });
});

// ---------------------------------------------------------------------------
// Retryable Graph error
// ---------------------------------------------------------------------------

describe('processNotification — retryable error', () => {
  it('marks delivery as retrying when Graph returns a 429', async () => {
    resolveRules.mockResolvedValue([RULE]);
    expandGroup.mockResolvedValue([{ type: 'user', id: 'usr_1', details: USER_ROW }]);
    const throttleErr = Object.assign(new Error('Too Many Requests'), { statusCode: 429 });
    sendChatMessage.mockRejectedValue(throttleErr);

    await processNotification('src_1', 'alarm', {});

    expect(auditService.markDeliveryRetrying).toHaveBeenCalledWith('dlv_1');
    expect(auditService.markDeliveryFailed).not.toHaveBeenCalled();
  });

  it('marks delivery failed for non-retryable Graph errors', async () => {
    resolveRules.mockResolvedValue([RULE]);
    expandGroup.mockResolvedValue([{ type: 'user', id: 'usr_1', details: USER_ROW }]);
    const forbiddenErr = Object.assign(new Error('Forbidden'), { statusCode: 403 });
    sendChatMessage.mockRejectedValue(forbiddenErr);

    await processNotification('src_1', 'alarm', {});

    expect(auditService.markDeliveryFailed).toHaveBeenCalled();
    expect(auditService.markDeliveryRetrying).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Proxy account not signed in
// ---------------------------------------------------------------------------

describe('processNotification — proxy account not signed in', () => {
  it('marks deliveries failed when proxy account is absent', async () => {
    getProxyAccount.mockResolvedValue(null);
    resolveRules.mockResolvedValue([RULE]);
    expandGroup.mockResolvedValue([{ type: 'user', id: 'usr_1', details: USER_ROW }]);

    await processNotification('src_1', 'alarm', {});

    expect(auditService.markDeliveryFailed).toHaveBeenCalledWith('dlv_1', expect.stringContaining('proxy'));
  });

  it('marks deliveries failed when proxy account status is signed_out', async () => {
    getProxyAccount.mockResolvedValue({ aad_user_id: 'oid', status: 'signed_out' });
    resolveRules.mockResolvedValue([RULE]);
    expandGroup.mockResolvedValue([{ type: 'user', id: 'usr_1', details: USER_ROW }]);

    await processNotification('src_1', 'alarm', {});

    expect(auditService.markDeliveryFailed).toHaveBeenCalled();
  });
});
