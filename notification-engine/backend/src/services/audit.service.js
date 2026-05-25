import * as notificationsRepo from '../repositories/notifications.repo.js';
import * as deliveriesRepo from '../repositories/deliveries.repo.js';

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
