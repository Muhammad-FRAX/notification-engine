import { HttpError } from '../../util/HttpError.js';
import {
  listNotificationsForAdmin,
  getNotificationDetail,
  retryNotificationDeliveries,
  retryOneDelivery,
  getStats as getStatsService,
} from '../../services/audit.service.js';

export async function list(req, res, next) {
  try {
    const { status, source_id, event_type, from, to } = req.query;
    const limitRaw = parseInt(req.query.limit ?? '50', 10);
    const offsetRaw = parseInt(req.query.offset ?? '0', 10);
    const limit = isNaN(limitRaw) ? 50 : Math.min(limitRaw, 200);
    const offset = isNaN(offsetRaw) ? 0 : Math.max(0, offsetRaw);

    const notifications = await listNotificationsForAdmin({
      status,
      sourceId: source_id,
      eventType: event_type,
      from,
      to,
      limit,
      offset,
    });
    res.json(notifications);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const detail = await getNotificationDetail(req.params.id);
    if (!detail) return next(new HttpError(404, 'not_found', 'Notification not found.'));
    res.json(detail);
  } catch (err) {
    next(err);
  }
}

export async function retryNotification(req, res, next) {
  try {
    const result = await retryNotificationDeliveries(req.params.id);
    if (!result) return next(new HttpError(404, 'not_found', 'Notification not found.'));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function retryDelivery(req, res, next) {
  try {
    const result = await retryOneDelivery(req.params.id);
    if (!result) return next(new HttpError(404, 'not_found', 'Delivery not found.'));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getStats(req, res, next) {
  try {
    const stats = await getStatsService();
    res.json(stats);
  } catch (err) {
    next(err);
  }
}
