import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import * as notificationsRepo from '../repositories/notifications.repo.js';
import * as deliveriesRepo from '../repositories/deliveries.repo.js';
import {
  createNotification,
  updateNotification,
  createDelivery,
  markDeliverySent,
  markDeliveryFailed,
  markDeliveryRetrying,
  computeAndUpdateNotificationStatus,
  listNotificationsForAdmin,
  getNotificationDetail,
  retryNotificationDeliveries,
  retryOneDelivery,
  getStats,
} from '../services/audit.service.js';
import { HttpError } from '../util/HttpError.js';

beforeEach(() => vi.clearAllMocks());

describe('createNotification', () => {
  it('happy path: calls repo.create with queued status and returns the row', async () => {
    const row = { id: 'ntf_1', status: 'queued' };
    notificationsRepo.create.mockResolvedValue(row);
    const result = await createNotification({ sourceId: 'src_1', eventType: 'alarm', payload: {} });
    expect(result).toEqual(row);
    expect(notificationsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'queued', sourceId: 'src_1', eventType: 'alarm' }),
    );
  });

  it('error path: propagates DB errors', async () => {
    notificationsRepo.create.mockRejectedValue(new Error('connection lost'));
    await expect(createNotification({ sourceId: 's', eventType: 'e', payload: {} })).rejects.toThrow('connection lost');
  });
});

describe('createDelivery', () => {
  it('happy path: creates a delivery row with queued status', async () => {
    const row = { id: 'dlv_1', status: 'queued' };
    deliveriesRepo.create.mockResolvedValue(row);
    const result = await createDelivery({
      notificationId: 'ntf_1',
      ruleId: 'rul_1',
      groupId: 'grp_1',
      recipientType: 'user',
      recipientId: 'usr_1',
    });
    expect(result).toEqual(row);
    expect(deliveriesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'queued', notificationId: 'ntf_1', recipientType: 'user' }),
    );
  });

  it('error path: propagates repo errors', async () => {
    deliveriesRepo.create.mockRejectedValue(new Error('FK error'));
    await expect(createDelivery({ notificationId: 'n', ruleId: 'r', groupId: 'g', recipientType: 'user', recipientId: 'u' }))
      .rejects.toThrow('FK error');
  });
});

describe('markDeliverySent', () => {
  it('happy path: forwards to deliveries.markSent', async () => {
    deliveriesRepo.markSent.mockResolvedValue({ id: 'dlv_1', status: 'sent' });
    await markDeliverySent('dlv_1', { graphChatId: 'chat_1', graphMessageId: 'msg_1' });
    expect(deliveriesRepo.markSent).toHaveBeenCalledWith('dlv_1', { graphChatId: 'chat_1', graphMessageId: 'msg_1' });
  });
});

describe('markDeliveryFailed', () => {
  it('happy path: forwards to deliveries.markFailed', async () => {
    deliveriesRepo.markFailed.mockResolvedValue({ id: 'dlv_1', status: 'failed' });
    await markDeliveryFailed('dlv_1', 'Graph 403');
    expect(deliveriesRepo.markFailed).toHaveBeenCalledWith('dlv_1', 'Graph 403');
  });
});

describe('markDeliveryRetrying', () => {
  it('happy path: forwards to deliveries.markRetrying', async () => {
    deliveriesRepo.markRetrying.mockResolvedValue({ id: 'dlv_1', status: 'retrying', attempts: 1 });
    await markDeliveryRetrying('dlv_1');
    expect(deliveriesRepo.markRetrying).toHaveBeenCalledWith('dlv_1');
  });
});

describe('computeAndUpdateNotificationStatus', () => {
  it('happy path: all sent → status sent', async () => {
    deliveriesRepo.listByNotification.mockResolvedValue([
      { status: 'sent' }, { status: 'sent' },
    ]);
    notificationsRepo.update.mockResolvedValue({});
    const status = await computeAndUpdateNotificationStatus('ntf_1');
    expect(status).toBe('sent');
    expect(notificationsRepo.update).toHaveBeenCalledWith('ntf_1', expect.objectContaining({ status: 'sent', recipientCount: 2 }));
  });

  it('edge case: some sent, some failed → partial', async () => {
    deliveriesRepo.listByNotification.mockResolvedValue([
      { status: 'sent' }, { status: 'failed' },
    ]);
    notificationsRepo.update.mockResolvedValue({});
    const status = await computeAndUpdateNotificationStatus('ntf_1');
    expect(status).toBe('partial');
  });

  it('edge case: all failed → failed', async () => {
    deliveriesRepo.listByNotification.mockResolvedValue([
      { status: 'failed' }, { status: 'failed' },
    ]);
    notificationsRepo.update.mockResolvedValue({});
    const status = await computeAndUpdateNotificationStatus('ntf_1');
    expect(status).toBe('failed');
  });

  it('edge case: no deliveries → unrouted', async () => {
    deliveriesRepo.listByNotification.mockResolvedValue([]);
    notificationsRepo.update.mockResolvedValue({});
    const status = await computeAndUpdateNotificationStatus('ntf_1');
    expect(status).toBe('unrouted');
  });

  it('error path: propagates listByNotification errors', async () => {
    deliveriesRepo.listByNotification.mockRejectedValue(new Error('DB error'));
    await expect(computeAndUpdateNotificationStatus('ntf_1')).rejects.toThrow('DB error');
  });
});

describe('updateNotification', () => {
  it('happy path: forwards to notifications.update', async () => {
    notificationsRepo.update.mockResolvedValue({ id: 'ntf_1' });
    await updateNotification('ntf_1', { status: 'sent' });
    expect(notificationsRepo.update).toHaveBeenCalledWith('ntf_1', { status: 'sent' });
  });
});

describe('listNotificationsForAdmin', () => {
  it('happy path: delegates filters to repo', async () => {
    const rows = [{ id: 'ntf_1' }];
    notificationsRepo.listNotifications.mockResolvedValue(rows);
    const result = await listNotificationsForAdmin({ status: 'failed', limit: 10, offset: 0 });
    expect(result).toEqual(rows);
    expect(notificationsRepo.listNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', limit: 10 })
    );
  });

  it('edge case: no filters uses defaults', async () => {
    notificationsRepo.listNotifications.mockResolvedValue([]);
    await listNotificationsForAdmin();
    expect(notificationsRepo.listNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, offset: 0 })
    );
  });

  it('error path: propagates repo errors', async () => {
    notificationsRepo.listNotifications.mockRejectedValue(new Error('timeout'));
    await expect(listNotificationsForAdmin()).rejects.toThrow('timeout');
  });
});

describe('getNotificationDetail', () => {
  it('happy path: returns notification merged with deliveries', async () => {
    const notification = { id: 'ntf_1', event_type: 'alarm' };
    const deliveries = [{ id: 'dlv_1', status: 'sent' }];
    notificationsRepo.findById.mockResolvedValue(notification);
    deliveriesRepo.listByNotification.mockResolvedValue(deliveries);
    const result = await getNotificationDetail('ntf_1');
    expect(result).toEqual({ ...notification, deliveries });
  });

  it('edge case: returns null when notification not found', async () => {
    notificationsRepo.findById.mockResolvedValue(null);
    const result = await getNotificationDetail('ntf_missing');
    expect(result).toBeNull();
    expect(deliveriesRepo.listByNotification).not.toHaveBeenCalled();
  });

  it('error path: propagates repo error', async () => {
    notificationsRepo.findById.mockRejectedValue(new Error('DB error'));
    await expect(getNotificationDetail('ntf_1')).rejects.toThrow('DB error');
  });
});

describe('retryNotificationDeliveries', () => {
  it('happy path: resets failed deliveries and returns queued count', async () => {
    const notification = { id: 'ntf_1' };
    const deliveries = [
      { id: 'dlv_1', status: 'failed' },
      { id: 'dlv_2', status: 'sent' },
      { id: 'dlv_3', status: 'failed' },
    ];
    notificationsRepo.findById.mockResolvedValue(notification);
    deliveriesRepo.listByNotification.mockResolvedValue(deliveries);
    deliveriesRepo.resetForRetry.mockResolvedValue({});
    notificationsRepo.update.mockResolvedValue({});
    const result = await retryNotificationDeliveries('ntf_1');
    expect(result.queued).toBe(2);
    expect(deliveriesRepo.resetForRetry).toHaveBeenCalledTimes(2);
  });

  it('edge case: returns queued 0 when no failed deliveries', async () => {
    notificationsRepo.findById.mockResolvedValue({ id: 'ntf_1' });
    deliveriesRepo.listByNotification.mockResolvedValue([{ id: 'dlv_1', status: 'sent' }]);
    const result = await retryNotificationDeliveries('ntf_1');
    expect(result).toEqual({ queued: 0 });
    expect(deliveriesRepo.resetForRetry).not.toHaveBeenCalled();
  });

  it('error path: returns null when notification not found', async () => {
    notificationsRepo.findById.mockResolvedValue(null);
    const result = await retryNotificationDeliveries('ntf_missing');
    expect(result).toBeNull();
  });
});

describe('retryOneDelivery', () => {
  it('happy path: resets a failed delivery and returns updated row', async () => {
    const delivery = { id: 'dlv_1', status: 'failed', notification_id: 'ntf_1' };
    const reset = { id: 'dlv_1', status: 'retrying', attempts: 0 };
    deliveriesRepo.findById.mockResolvedValue(delivery);
    deliveriesRepo.resetForRetry.mockResolvedValue(reset);
    deliveriesRepo.listByNotification.mockResolvedValue([reset]);
    notificationsRepo.update.mockResolvedValue({});
    const result = await retryOneDelivery('dlv_1');
    expect(result).toEqual(reset);
    expect(deliveriesRepo.resetForRetry).toHaveBeenCalledWith('dlv_1');
  });

  it('edge case: throws 409 when delivery is not in failed state', async () => {
    deliveriesRepo.findById.mockResolvedValue({ id: 'dlv_1', status: 'sent', notification_id: 'ntf_1' });
    const err = await retryOneDelivery('dlv_1').catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('not_retryable');
  });

  it('error path: returns null when delivery not found', async () => {
    deliveriesRepo.findById.mockResolvedValue(null);
    const result = await retryOneDelivery('dlv_missing');
    expect(result).toBeNull();
  });
});

describe('getStats', () => {
  it('happy path: returns stats from repo', async () => {
    const stats = {
      notifications: { total: 10, by_status: { sent: 8, failed: 2 } },
      deliveries: { retrying: 1 },
    };
    notificationsRepo.getStats.mockResolvedValue(stats);
    const result = await getStats();
    expect(result).toEqual(stats);
  });

  it('error path: propagates repo error', async () => {
    notificationsRepo.getStats.mockRejectedValue(new Error('DB offline'));
    await expect(getStats()).rejects.toThrow('DB offline');
  });
});
