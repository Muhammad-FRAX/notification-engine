import { z } from 'zod';
import { processNotification } from '../services/notification.service.js';
import { HttpError } from '../util/HttpError.js';

const attachmentSchema = z.object({
  kind: z.enum(['image']),
  filename: z.string(),
  base64: z.string(),
});

export const notificationSchema = z.object({
  event_type: z.string().min(1),
  title: z.string().optional(),
  body: z.string().optional(),
  severity: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  attachments: z.array(attachmentSchema).optional(),
  template_override: z.string().optional(),
});

export async function postNotification(req, res, next) {
  try {
    const parsed = notificationSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => e.message).join('; ');
      return next(new HttpError(400, 'validation_error', msg));
    }

    const { event_type } = parsed.data;
    const result = await processNotification(req.source.id, event_type, parsed.data);

    res.status(202).json({
      notification_id: result.notificationId,
      matched_groups: result.matchedGroups,
      queued_deliveries: result.queuedDeliveries,
    });
  } catch (err) {
    next(err);
  }
}
