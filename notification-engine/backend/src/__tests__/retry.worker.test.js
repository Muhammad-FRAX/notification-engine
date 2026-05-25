import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../repositories/deliveries.repo.js', () => ({
  expireMaxAttempts: vi.fn(),
  listRetrying: vi.fn(),
  markFailed: vi.fn(),
}));

vi.mock('../repositories/notifications.repo.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../repositories/rules.repo.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../repositories/recipients.repo.js', () => ({
  findUserById: vi.fn(),
  findChannelById: vi.fn(),
}));

vi.mock('../services/template.service.js', () => ({
  getEffectiveTemplate: vi.fn(),
  renderTemplate: vi.fn(),
}));

vi.mock('../repositories/proxyAccount.repo.js', () => ({
  getProxyAccount: vi.fn(),
}));

vi.mock('../services/notification.service.js', () => ({
  sendToRecipient: vi.fn(),
}));

vi.mock('../services/audit.service.js', () => ({
  computeAndUpdateNotificationStatus: vi.fn(),
}));

vi.mock('../config.js', () => ({
  default: {
    retryMaxAttempts: 5,
    retryBaseDelayMs: 30_000,
  },
}));

import * as deliveriesRepo from '../repositories/deliveries.repo.js';
import * as notificationsRepo from '../repositories/notifications.repo.js';
import * as rulesRepo from '../repositories/rules.repo.js';
import * as recipientsRepo from '../repositories/recipients.repo.js';
import { getEffectiveTemplate, renderTemplate } from '../services/template.service.js';
import { getProxyAccount } from '../repositories/proxyAccount.repo.js';
import { sendToRecipient } from '../services/notification.service.js';
import { computeAndUpdateNotificationStatus } from '../services/audit.service.js';
import { computeBackoffMs, processRetryBatch, start, stop } from '../services/retry.worker.js';

beforeEach(() => {
  vi.clearAllMocks();
  stop();
});

afterEach(() => {
  stop();
});

// ---------------------------------------------------------------------------
// computeBackoffMs — pure function
// ---------------------------------------------------------------------------

describe('computeBackoffMs', () => {
  it('doubles the base delay for each attempt (attempts=1)', () => {
    expect(computeBackoffMs(1, 30_000)).toBe(60_000);
  });

  it('returns the base delay when attempts=0', () => {
    expect(computeBackoffMs(0, 30_000)).toBe(30_000);
  });

  it('applies full exponential growth at the last attempt (attempts=4)', () => {
    expect(computeBackoffMs(4, 30_000)).toBe(30_000 * 16);
  });
});

// ---------------------------------------------------------------------------
// processRetryBatch — no eligible rows
// ---------------------------------------------------------------------------

describe('processRetryBatch — no eligible rows', () => {
  it('does nothing when listRetrying returns an empty array', async () => {
    deliveriesRepo.expireMaxAttempts.mockResolvedValue();
    deliveriesRepo.listRetrying.mockResolvedValue([]);

    await processRetryBatch();

    expect(sendToRecipient).not.toHaveBeenCalled();
    expect(computeAndUpdateNotificationStatus).not.toHaveBeenCalled();
  });

  it('skips rows whose backoff period has not elapsed', async () => {
    const recentAttempt = new Date(Date.now() - 10_000).toISOString();
    deliveriesRepo.expireMaxAttempts.mockResolvedValue();
    deliveriesRepo.listRetrying.mockResolvedValue([
      { id: 'dlv_1', notification_id: 'ntf_1', recipient_type: 'user', recipient_id: 'usr_1',
        rule_id: 'rul_1', attempts: 1, last_attempted_at: recentAttempt },
    ]);

    await processRetryBatch();

    expect(sendToRecipient).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// processRetryBatch — happy path
// ---------------------------------------------------------------------------

describe('processRetryBatch — happy path', () => {
  const OLD_ATTEMPT = new Date(Date.now() - 120_000).toISOString();
  const DELIVERY = {
    id: 'dlv_1', notification_id: 'ntf_1', recipient_type: 'user',
    recipient_id: 'usr_1', rule_id: 'rul_1', attempts: 1, last_attempted_at: OLD_ATTEMPT,
  };
  const NOTIFICATION = { id: 'ntf_1', payload: JSON.stringify({ event_type: 'test', title: 'T' }) };
  const RULE = { id: 'rul_1', template_id: 'tpl_1' };
  const USER = { id: 'usr_1', upn: 'alice@example.com', aad_user_id: null };
  const TEMPLATE = { id: 'tpl_1', kind: 'text_html', body: '{{title}}', vars_schema: null };
  const RENDERED = { htmlBody: '<p>T</p>', attachments: [], hostedContents: [] };
  const PROXY = { aad_user_id: 'proxy-oid', status: 'signed_in' };

  beforeEach(() => {
    deliveriesRepo.expireMaxAttempts.mockResolvedValue();
    deliveriesRepo.listRetrying.mockResolvedValue([DELIVERY]);
    notificationsRepo.findById.mockResolvedValue(NOTIFICATION);
    rulesRepo.findById.mockResolvedValue(RULE);
    recipientsRepo.findUserById.mockResolvedValue(USER);
    getEffectiveTemplate.mockResolvedValue(TEMPLATE);
    renderTemplate.mockReturnValue(RENDERED);
    getProxyAccount.mockResolvedValue(PROXY);
    sendToRecipient.mockResolvedValue();
    computeAndUpdateNotificationStatus.mockResolvedValue('sent');
  });

  it('retries eligible deliveries and recomputes notification status', async () => {
    await processRetryBatch();

    expect(deliveriesRepo.expireMaxAttempts).toHaveBeenCalledWith(5);
    expect(sendToRecipient).toHaveBeenCalledWith(
      DELIVERY,
      { type: 'user', id: 'usr_1', details: USER },
      RENDERED,
      PROXY,
    );
    expect(computeAndUpdateNotificationStatus).toHaveBeenCalledWith('ntf_1');
  });

  it('handles channel recipients', async () => {
    const channelDelivery = { ...DELIVERY, recipient_type: 'channel', recipient_id: 'chn_1' };
    const channelDetails = { id: 'chn_1', team_id: 't1', channel_id: 'c1' };
    deliveriesRepo.listRetrying.mockResolvedValue([channelDelivery]);
    recipientsRepo.findChannelById.mockResolvedValue(channelDetails);

    await processRetryBatch();

    expect(sendToRecipient).toHaveBeenCalledWith(
      channelDelivery,
      { type: 'channel', id: 'chn_1', details: channelDetails },
      RENDERED,
      PROXY,
    );
  });

  it('uses default template when delivery has no rule_id', async () => {
    const noRuleDelivery = { ...DELIVERY, rule_id: null };
    deliveriesRepo.listRetrying.mockResolvedValue([noRuleDelivery]);

    await processRetryBatch();

    expect(rulesRepo.findById).not.toHaveBeenCalled();
    expect(getEffectiveTemplate).toHaveBeenCalledWith(null);
  });
});

// ---------------------------------------------------------------------------
// processRetryBatch — error paths
// ---------------------------------------------------------------------------

describe('processRetryBatch — error paths', () => {
  const OLD_ATTEMPT = new Date(Date.now() - 120_000).toISOString();
  const DELIVERY = {
    id: 'dlv_1', notification_id: 'ntf_1', recipient_type: 'user',
    recipient_id: 'usr_1', rule_id: 'rul_1', attempts: 1, last_attempted_at: OLD_ATTEMPT,
  };

  beforeEach(() => {
    deliveriesRepo.expireMaxAttempts.mockResolvedValue();
    deliveriesRepo.listRetrying.mockResolvedValue([DELIVERY]);
    notificationsRepo.findById.mockResolvedValue(
      { id: 'ntf_1', payload: JSON.stringify({ event_type: 'test', title: 'T' }) }
    );
    rulesRepo.findById.mockResolvedValue({ id: 'rul_1', template_id: 'tpl_1' });
    recipientsRepo.findUserById.mockResolvedValue({ id: 'usr_1', upn: 'a@b.com' });
    getEffectiveTemplate.mockResolvedValue({ id: 'tpl_1', kind: 'text_html', body: '{{title}}', vars_schema: null });
    getProxyAccount.mockResolvedValue({ aad_user_id: 'oid', status: 'signed_in' });
  });

  it('marks delivery failed and continues when template render throws', async () => {
    const renderErr = Object.assign(new Error('missing field'), { code: 'template_validation' });
    renderTemplate.mockImplementation(() => { throw renderErr; });
    deliveriesRepo.markFailed.mockResolvedValue();
    computeAndUpdateNotificationStatus.mockResolvedValue('failed');

    await processRetryBatch();

    expect(deliveriesRepo.markFailed).toHaveBeenCalledWith(
      'dlv_1',
      expect.stringContaining('template_validation'),
    );
    expect(sendToRecipient).not.toHaveBeenCalled();
    expect(computeAndUpdateNotificationStatus).toHaveBeenCalledWith('ntf_1');
  });

  it('skips delivery when notification no longer exists', async () => {
    notificationsRepo.findById.mockResolvedValue(null);
    renderTemplate.mockReturnValue({ htmlBody: '', attachments: [], hostedContents: [] });

    await processRetryBatch();

    expect(sendToRecipient).not.toHaveBeenCalled();
    expect(computeAndUpdateNotificationStatus).not.toHaveBeenCalled();
  });

  it('skips delivery when recipient no longer exists', async () => {
    recipientsRepo.findUserById.mockResolvedValue(null);
    renderTemplate.mockReturnValue({ htmlBody: '', attachments: [], hostedContents: [] });

    await processRetryBatch();

    expect(sendToRecipient).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// start / stop lifecycle
// ---------------------------------------------------------------------------

describe('start / stop', () => {
  it('calling start twice does not create a second interval', () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(global, 'setInterval');

    start(60_000);
    start(60_000);

    expect(spy).toHaveBeenCalledTimes(1);
    stop();
    vi.useRealTimers();
    spy.mockRestore();
  });

  it('stop clears the interval', () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(global, 'clearInterval');

    start(60_000);
    stop();

    expect(clearSpy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    clearSpy.mockRestore();
  });
});
