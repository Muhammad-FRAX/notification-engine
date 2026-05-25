import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/notification.service.js', () => ({
  processNotification: vi.fn(),
}));

import { processNotification } from '../services/notification.service.js';
import { postNotification, notificationSchema } from '../controllers/notifications.controller.js';
import { HttpError } from '../util/HttpError.js';

const makeReq = (body, source = { id: 'src_1' }) => ({ body, source });
const makeRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// notificationSchema — pure Zod validation, no mocks needed
// ---------------------------------------------------------------------------

describe('notificationSchema', () => {
  it('accepts a minimal valid payload (event_type only)', () => {
    const result = notificationSchema.safeParse({ event_type: 'alarm' });
    expect(result.success).toBe(true);
  });

  it('accepts a fully populated payload', () => {
    const result = notificationSchema.safeParse({
      event_type: 'kpi.degraded',
      title: 'Revenue KPI dropped',
      body: 'Investigation started',
      severity: 'high',
      data: { kpi: 0.3 },
      attachments: [{ kind: 'image', filename: 'chart.png', base64: 'abc=' }],
      template_override: 'kpi-card-v2',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a payload missing event_type', () => {
    const result = notificationSchema.safeParse({ title: 'No event type here' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty event_type string', () => {
    const result = notificationSchema.safeParse({ event_type: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an attachment with an unsupported kind', () => {
    const result = notificationSchema.safeParse({
      event_type: 'alarm',
      attachments: [{ kind: 'video', filename: 'clip.mp4', base64: 'abc=' }],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// postNotification controller
// ---------------------------------------------------------------------------

describe('postNotification', () => {
  describe('happy path', () => {
    it('responds 202 with notification_id, matched_groups, queued_deliveries', async () => {
      processNotification.mockResolvedValue({
        notificationId: 'ntf_abc',
        matchedGroups: ['grp_1'],
        queuedDeliveries: 3,
      });

      const req = makeReq({ event_type: 'alarm', title: 'Test alert' });
      const res = makeRes();
      const next = vi.fn();

      await postNotification(req, res, next);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({
        notification_id: 'ntf_abc',
        matched_groups: ['grp_1'],
        queued_deliveries: 3,
      });
      expect(processNotification).toHaveBeenCalledWith('src_1', 'alarm', expect.objectContaining({ event_type: 'alarm' }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('edge case', () => {
    it('calls next with HttpError(400) when event_type is missing', async () => {
      const req = makeReq({ title: 'Missing event_type' });
      const res = makeRes();
      const next = vi.fn();

      await postNotification(req, res, next);

      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(HttpError);
      expect(err.status).toBe(400);
      expect(err.code).toBe('validation_error');
      expect(processNotification).not.toHaveBeenCalled();
    });
  });

  describe('error path', () => {
    it('forwards errors from processNotification to next', async () => {
      processNotification.mockRejectedValue(new Error('DB exploded'));
      const req = makeReq({ event_type: 'alarm' });
      const res = makeRes();
      const next = vi.fn();

      await postNotification(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'DB exploded' }));
    });
  });
});
