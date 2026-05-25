import { resolveRules } from './routing.service.js';
import { expandGroup } from './audience.service.js';
import { getEffectiveTemplate, renderTemplate } from './template.service.js';
import * as auditService from './audit.service.js';
import { createOneOnOneChat, sendChatMessage, sendChannelMessage } from '../integrations/graph.service.js';
import { getProxyAccount } from '../repositories/proxyAccount.repo.js';

/**
 * Returns true for errors that warrant an automatic retry:
 *   HTTP 429 (throttled), 5xx (server error), or transient network faults.
 */
function isRetryable(err) {
  const code = err.statusCode ?? err.status ?? err.response?.status;
  if (code === 429 || (code >= 500 && code < 600)) return true;
  return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(err.code);
}

/**
 * Attempts to send to one recipient and updates the delivery row accordingly.
 * Never throws — errors are captured into the delivery row (failed or retrying).
 */
async function sendToRecipient(delivery, recipient, rendered, proxyAccount) {
  const { htmlBody, attachments, hostedContents } = rendered;
  const opts = { attachments, hostedContents };

  try {
    if (!proxyAccount || proxyAccount.status !== 'signed_in') {
      throw Object.assign(new Error('proxy_account_not_signed_in'), { code: 'PROXY_NOT_SIGNED_IN' });
    }

    let graphChatId = null;
    let graphMessageId = null;

    if (recipient.type === 'user') {
      const targetId = recipient.details.aad_user_id || recipient.details.upn;
      graphChatId = await createOneOnOneChat(proxyAccount.aad_user_id, targetId);
      const msg = await sendChatMessage(graphChatId, htmlBody, opts);
      graphMessageId = msg.id;
    } else if (recipient.type === 'channel') {
      const msg = await sendChannelMessage(
        recipient.details.team_id,
        recipient.details.channel_id,
        htmlBody,
        opts,
      );
      graphMessageId = msg.id;
    }

    await auditService.markDeliverySent(delivery.id, { graphChatId, graphMessageId });
  } catch (err) {
    if (isRetryable(err)) {
      await auditService.markDeliveryRetrying(delivery.id);
    } else {
      await auditService.markDeliveryFailed(delivery.id, err.message ?? String(err));
    }
  }
}

/**
 * Main orchestrator for processing an inbound notification.
 *
 * 1. Persists the notification row immediately (nothing is lost even if routing fails).
 * 2. Resolves matching rules for (sourceId, eventType).
 * 3. For each rule, expands the group into recipients — de-duplicating across rules so
 *    the same recipient never gets the same message twice in one notification.
 * 4. Renders the rule's template; if validation fails all recipients for that rule get
 *    a failed delivery row and processing continues with the next rule.
 * 5. Creates delivery rows and attempts Graph sends concurrently.
 * 6. Computes and persists the aggregate notification status.
 *
 * Returns { notificationId, matchedGroups, queuedDeliveries }.
 */
export async function processNotification(sourceId, eventType, payload) {
  const notification = await auditService.createNotification({ sourceId, eventType, payload });

  const rules = await resolveRules(sourceId, eventType);

  if (rules.length === 0) {
    await auditService.updateNotification(notification.id, { status: 'unrouted' });
    return { notificationId: notification.id, matchedGroups: [], queuedDeliveries: 0 };
  }

  await auditService.updateNotification(notification.id, {
    status: 'sending',
    matchedRules: rules.map((r) => r.id),
  });

  const proxyAccount = await getProxyAccount();

  const seenRecipients = new Set();
  const matchedGroupIds = [];
  const deliveryTasks = [];

  for (const rule of rules) {
    const recipients = await expandGroup(rule.group_id);
    const template = await getEffectiveTemplate(rule.template_id);

    let rendered;
    try {
      rendered = renderTemplate(template, payload, payload.attachments ?? []);
    } catch (err) {
      if (err.code === 'template_validation') {
        for (const recipient of recipients) {
          const key = `${recipient.type}:${recipient.id}`;
          if (seenRecipients.has(key)) continue;
          seenRecipients.add(key);
          const delivery = await auditService.createDelivery({
            notificationId: notification.id,
            ruleId: rule.id,
            groupId: rule.group_id,
            recipientType: recipient.type,
            recipientId: recipient.id,
          });
          await auditService.markDeliveryFailed(delivery.id, `template_validation: ${err.message}`);
        }
        continue;
      }
      throw err;
    }

    if (!matchedGroupIds.includes(rule.group_id)) {
      matchedGroupIds.push(rule.group_id);
    }

    for (const recipient of recipients) {
      const key = `${recipient.type}:${recipient.id}`;
      if (seenRecipients.has(key)) continue;
      seenRecipients.add(key);

      const delivery = await auditService.createDelivery({
        notificationId: notification.id,
        ruleId: rule.id,
        groupId: rule.group_id,
        recipientType: recipient.type,
        recipientId: recipient.id,
      });

      deliveryTasks.push(sendToRecipient(delivery, recipient, rendered, proxyAccount));
    }
  }

  await Promise.allSettled(deliveryTasks);

  await auditService.computeAndUpdateNotificationStatus(notification.id);

  return {
    notificationId: notification.id,
    matchedGroups: matchedGroupIds,
    queuedDeliveries: seenRecipients.size,
  };
}
