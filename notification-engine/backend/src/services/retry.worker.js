import config from '../config.js';
import * as deliveriesRepo from '../repositories/deliveries.repo.js';
import * as notificationsRepo from '../repositories/notifications.repo.js';
import * as rulesRepo from '../repositories/rules.repo.js';
import * as recipientsRepo from '../repositories/recipients.repo.js';
import { getEffectiveTemplate, renderTemplate } from './template.service.js';
import { getProxyAccount } from '../repositories/proxyAccount.repo.js';
import { sendToRecipient } from './notification.service.js';
import { computeAndUpdateNotificationStatus } from './audit.service.js';

/**
 * Returns the milliseconds to wait before the next retry attempt.
 * Doubles with each attempt: baseDelayMs * 2^attempts.
 */
export function computeBackoffMs(attempts, baseDelayMs) {
  return baseDelayMs * Math.pow(2, attempts);
}

/**
 * One tick of the retry loop.
 *
 * 1. Permanently fail any delivery that has hit the attempt ceiling — these
 *    were put back to 'retrying' by a previous tick and then hit max attempts.
 * 2. Load all remaining 'retrying' rows under the attempt ceiling.
 * 3. Discard rows whose backoff period has not elapsed yet.
 * 4. For each eligible row, re-assemble the send context from the DB and
 *    delegate to sendToRecipient (which updates the delivery row itself).
 * 5. Recompute the aggregate status on every parent notification that was touched.
 */
export async function processRetryBatch() {
  const { retryMaxAttempts, retryBaseDelayMs } = config;

  await deliveriesRepo.expireMaxAttempts(retryMaxAttempts);

  const candidates = await deliveriesRepo.listRetrying(retryMaxAttempts);
  if (candidates.length === 0) return;

  const now = Date.now();
  const eligible = candidates.filter((row) => {
    if (!row.last_attempted_at) return true;
    const elapsed = now - new Date(row.last_attempted_at).getTime();
    return elapsed >= computeBackoffMs(row.attempts, retryBaseDelayMs);
  });

  if (eligible.length === 0) return;

  const proxyAccount = await getProxyAccount();
  const affectedNotifications = new Set();

  for (const delivery of eligible) {
    try {
      const notification = await notificationsRepo.findById(delivery.notification_id);
      if (!notification) continue;

      let recipientDetails;
      if (delivery.recipient_type === 'user') {
        recipientDetails = await recipientsRepo.findUserById(delivery.recipient_id);
      } else {
        recipientDetails = await recipientsRepo.findChannelById(delivery.recipient_id);
      }
      if (!recipientDetails) continue;

      const recipient = {
        type: delivery.recipient_type,
        id: delivery.recipient_id,
        details: recipientDetails,
      };

      let templateId = null;
      if (delivery.rule_id) {
        const rule = await rulesRepo.findById(delivery.rule_id);
        templateId = rule?.template_id ?? null;
      }
      const template = await getEffectiveTemplate(templateId);

      const payload =
        typeof notification.payload === 'string'
          ? JSON.parse(notification.payload)
          : notification.payload;

      let rendered;
      try {
        rendered = renderTemplate(template, payload, payload.attachments ?? []);
      } catch (err) {
        await deliveriesRepo.markFailed(delivery.id, `template_validation: ${err.message}`);
        affectedNotifications.add(delivery.notification_id);
        continue;
      }

      await sendToRecipient(delivery, recipient, rendered, proxyAccount);
      affectedNotifications.add(delivery.notification_id);
    } catch (err) {
      console.error(`[retry.worker] Unexpected error processing delivery ${delivery.id}: ${err.message}`);
    }
  }

  for (const notificationId of affectedNotifications) {
    try {
      await computeAndUpdateNotificationStatus(notificationId);
    } catch (err) {
      console.error(`[retry.worker] Failed to recompute status for ${notificationId}: ${err.message}`);
    }
  }
}

let intervalHandle = null;

export function start(intervalMs = 30_000) {
  if (intervalHandle !== null) return;
  intervalHandle = setInterval(async () => {
    try {
      await processRetryBatch();
    } catch (err) {
      console.error('[retry.worker] Unhandled error in retry batch:', err.message);
    }
  }, intervalMs);
  console.log(`[retry.worker] Started — interval ${intervalMs / 1000}s`);
}

export function stop() {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
