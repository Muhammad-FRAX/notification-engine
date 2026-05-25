import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/audit.service.js', () => ({
  listNotificationsForAdmin: vi.fn(),
  getNotificationDetail: vi.fn(),
  retryNotificationDeliveries: vi.fn(),
  retryOneDelivery: vi.fn(),
  getStats: vi.fn(),
}));

import {
  listNotificationsForAdmin,
  getNotificationDetail,
  retryNotificationDeliveries,
  retryOneDelivery,
  getStats,
} from '../services/audit.service.js';

import {
  list,
  getOne,
  retryNotification,
  retryDelivery,
  getStats as getStatsController,
} from '../controllers/admin/audit.controller.js';

import { HttpError } from '../util/HttpError.js';

function makeReq(opts = {}) {
  return {
    query: opts.query ?? {},
    params: opts.params ?? {},
    body: opts.body ?? {},
  };
}

function makeRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

describe('list', () => {
  it('returns notifications with defaults when no query params', async () => {
    const rows = [{ id: 'ntf_1' }];
    listNotificationsForAdmin.mockResolvedValue(rows);
    const res = makeRes();
    await list(makeReq(), res, vi.fn());
    expect(res.json).toHaveBeenCalledWith(rows);
    expect(listNotificationsForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, offset: 0 })
    );
  });

  it('forwards filter query params to service', async () => {
    listNotificationsForAdmin.mockResolvedValue([]);
    const res = makeRes();
    await list(
      makeReq({ query: { status: 'failed', source_id: 'src_1', event_type: 'kpi.degraded' } }),
      res,
      vi.fn()
    );
    expect(listNotificationsForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', sourceId: 'src_1', eventType: 'kpi.degraded' })
    );
  });

  it('clamps limit to 200 when caller passes a larger value', async () => {
    listNotificationsForAdmin.mockResolvedValue([]);
    const res = makeRes();
    await list(makeReq({ query: { limit: '9999' } }), res, vi.fn());
    expect(listNotificationsForAdmin).toHaveBeenCalledWith(expect.objectContaining({ limit: 200 }));
  });

  it('propagates service errors to next', async () => {
    listNotificationsForAdmin.mockRejectedValue(new Error('DB timeout'));
    const next = vi.fn();
    await list(makeReq(), makeRes(), next);
    expect(next.mock.calls[0][0].message).toBe('DB timeout');
  });
});

// ---------------------------------------------------------------------------
// getOne
// ---------------------------------------------------------------------------

describe('getOne', () => {
  it('returns notification detail when found', async () => {
    const detail = { id: 'ntf_1', deliveries: [] };
    getNotificationDetail.mockResolvedValue(detail);
    const res = makeRes();
    await getOne(makeReq({ params: { id: 'ntf_1' } }), res, vi.fn());
    expect(res.json).toHaveBeenCalledWith(detail);
  });

  it('passes 404 when notification not found', async () => {
    getNotificationDetail.mockResolvedValue(null);
    const next = vi.fn();
    await getOne(makeReq({ params: { id: 'ntf_missing' } }), makeRes(), next);
    expect(next.mock.calls[0][0]).toBeInstanceOf(HttpError);
    expect(next.mock.calls[0][0].status).toBe(404);
  });

  it('propagates service error to next', async () => {
    getNotificationDetail.mockRejectedValue(new Error('pool exhausted'));
    const next = vi.fn();
    await getOne(makeReq({ params: { id: 'ntf_1' } }), makeRes(), next);
    expect(next.mock.calls[0][0].message).toBe('pool exhausted');
  });
});

// ---------------------------------------------------------------------------
// retryNotification
// ---------------------------------------------------------------------------

describe('retryNotification', () => {
  it('returns queued count on success', async () => {
    retryNotificationDeliveries.mockResolvedValue({ queued: 3 });
    const res = makeRes();
    await retryNotification(makeReq({ params: { id: 'ntf_1' } }), res, vi.fn());
    expect(res.json).toHaveBeenCalledWith({ queued: 3 });
  });

  it('passes 404 when notification not found', async () => {
    retryNotificationDeliveries.mockResolvedValue(null);
    const next = vi.fn();
    await retryNotification(makeReq({ params: { id: 'ntf_missing' } }), makeRes(), next);
    expect(next.mock.calls[0][0]).toBeInstanceOf(HttpError);
    expect(next.mock.calls[0][0].status).toBe(404);
  });

  it('propagates service error to next', async () => {
    retryNotificationDeliveries.mockRejectedValue(new Error('DB write failed'));
    const next = vi.fn();
    await retryNotification(makeReq({ params: { id: 'ntf_1' } }), makeRes(), next);
    expect(next.mock.calls[0][0].message).toBe('DB write failed');
  });
});

// ---------------------------------------------------------------------------
// retryDelivery
// ---------------------------------------------------------------------------

describe('retryDelivery', () => {
  it('returns reset delivery on success', async () => {
    const row = { id: 'dlv_1', status: 'retrying', attempts: 0 };
    retryOneDelivery.mockResolvedValue(row);
    const res = makeRes();
    await retryDelivery(makeReq({ params: { id: 'dlv_1' } }), res, vi.fn());
    expect(res.json).toHaveBeenCalledWith(row);
  });

  it('passes 404 when delivery not found', async () => {
    retryOneDelivery.mockResolvedValue(null);
    const next = vi.fn();
    await retryDelivery(makeReq({ params: { id: 'dlv_missing' } }), makeRes(), next);
    expect(next.mock.calls[0][0]).toBeInstanceOf(HttpError);
    expect(next.mock.calls[0][0].status).toBe(404);
  });

  it('forwards 409 from service when delivery is not failed', async () => {
    retryOneDelivery.mockRejectedValue(new HttpError(409, 'not_retryable', 'Only failed deliveries can be retried.'));
    const next = vi.fn();
    await retryDelivery(makeReq({ params: { id: 'dlv_1' } }), makeRes(), next);
    expect(next.mock.calls[0][0]).toBeInstanceOf(HttpError);
    expect(next.mock.calls[0][0].status).toBe(409);
    expect(next.mock.calls[0][0].code).toBe('not_retryable');
  });

  it('propagates service error to next', async () => {
    retryOneDelivery.mockRejectedValue(new Error('connection reset'));
    const next = vi.fn();
    await retryDelivery(makeReq({ params: { id: 'dlv_1' } }), makeRes(), next);
    expect(next.mock.calls[0][0].message).toBe('connection reset');
  });
});

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------

describe('getStatsController', () => {
  it('returns stats object', async () => {
    const stats = {
      notifications: { total: 42, by_status: { sent: 30, failed: 12 } },
      deliveries: { retrying: 2 },
    };
    getStats.mockResolvedValue(stats);
    const res = makeRes();
    await getStatsController(makeReq(), res, vi.fn());
    expect(res.json).toHaveBeenCalledWith(stats);
  });

  it('propagates service error to next', async () => {
    getStats.mockRejectedValue(new Error('DB offline'));
    const next = vi.fn();
    await getStatsController(makeReq(), makeRes(), next);
    expect(next.mock.calls[0][0].message).toBe('DB offline');
  });
});
