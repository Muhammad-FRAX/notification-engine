import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/notifications.repo.js', () => ({
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../repositories/deliveries.repo.js', () => ({
  create: vi.fn(),
  markSent: vi.fn(),
  markFailed: vi.fn(),
  markRetrying: vi.fn(),
  listByNotification: vi.fn(),
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
} from '../services/audit.service.js';

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
