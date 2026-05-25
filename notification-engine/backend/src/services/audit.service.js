import * as notificationsRepo from '../repositories/notifications.repo.js';
import * as deliveriesRepo from '../repositories/deliveries.repo.js';
import { HttpError } from '../util/HttpError.js';

export async function listNotificationsForAdmin({ status, sourceId, eventType, from, to, limit = 50, offset = 0 } = {}) {
  return notificationsRepo.listNotifications({ status, sourceId, eventType, from, to, limit, offset });
}

export async function getNotificationDetail(id) {
  const notification = await notificationsRepo.findById(id);
  if (!notification) return null;
  const deliveries = await deliveriesRepo.listByNotification(id);
  return { ...notification, deliveries };
}

export async function retryNotificationDeliveries(notificationId) {
  const notification = await notificationsRepo.findById(notificationId);
  if (!notification) return null;
  const deliveries = await deliveriesRepo.listByNotification(notificationId);
  const failed = deliveries.filter((d) => d.status === 'failed');
  await Promise.all(failed.map((d) => deliveriesRepo.resetForRetry(d.id)));
  if (failed.length > 0) {
    await computeAndUpdateNotificationStatus(notificationId);
  }
  return { queued: failed.length };
}

export async function retryOneDelivery(deliveryId) {
  const delivery = await deliveriesRepo.findById(deliveryId);
  if (!delivery) return null;
  if (delivery.status !== 'failed') {
    throw new HttpError(409, 'not_retryable', 'Only failed deliveries can be retried.');
  }
  const reset = await deliveriesRepo.resetForRetry(deliveryId);
  await computeAndUpdateNotificationStatus(delivery.notification_id);
  return reset;
}

export async function getStats() {
  return notificationsRepo.getStats();
}

export async function createNotification({ sourceId, eventType, payload }) {
  return notificationsRepo.create({ sourceId, eventType, payload, status: 'queued' });
}

export async function updateNotification(id, fields) {
  return notificationsRepo.update(id, fields);
}

export async function createDelivery({ notificationId, ruleId, groupId, recipientType, recipientId }) {
  return deliveriesRepo.create({
    notificationId,
    ruleId,
    groupId,
    recipientType,
    recipientId,
    status: 'queued',
  });
}

export async function markDeliverySent(id, { graphChatId = null, graphMessageId = null } = {}) {
  return deliveriesRepo.markSent(id, { graphChatId, graphMessageId });
}

export async function markDeliveryFailed(id, lastError) {
  return deliveriesRepo.markFailed(id, lastError);
}

export async function markDeliveryRetrying(id) {
  return deliveriesRepo.markRetrying(id);
}

/**
 * Reads all delivery rows for a notification, derives the aggregate status,
 * and persists it back to the notifications table.
 *
 *   all sent              → 'sent'
 *   some sent, rest not   → 'partial'
 *   none sent             → 'failed'
 *   no rows (unrouted)    → 'unrouted' (caller should avoid this path)
 *
 * Also writes recipient_count.
 * Returns the computed status string.
 */
export async function computeAndUpdateNotificationStatus(notificationId) {
  const deliveries = await deliveriesRepo.listByNotification(notificationId);

  if (deliveries.length === 0) {
    await notificationsRepo.update(notificationId, { status: 'unrouted' });
    return 'unrouted';
  }

  const allSent = deliveries.every((d) => d.status === 'sent');
  const someSent = deliveries.some((d) => d.status === 'sent');
  const status = allSent ? 'sent' : someSent ? 'partial' : 'failed';

  await notificationsRepo.update(notificationId, {
    status,
    recipientCount: deliveries.length,
  });

  return status;
}
