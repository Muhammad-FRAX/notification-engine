import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/rules.repo.js', () => ({
  listActiveBySource: vi.fn(),
}));

import { listActiveBySource } from '../repositories/rules.repo.js';
import { resolveRules } from '../services/routing.service.js';

beforeEach(() => vi.clearAllMocks());

describe('resolveRules', () => {
  describe('happy path', () => {
    it('returns rules whose event_pattern exactly matches the event type', async () => {
      const rule = { id: 'rul_1', event_pattern: 'alarm', group_id: 'grp_1', active: true };
      listActiveBySource.mockResolvedValue([rule]);
      const result = await resolveRules('src_1', 'alarm');
      expect(result).toEqual([rule]);
    });

    it('returns rules whose event_pattern wildcard matches the event type', async () => {
      const rule = { id: 'rul_2', event_pattern: 'kpi.*', group_id: 'grp_2', active: true };
      listActiveBySource.mockResolvedValue([rule]);
      const result = await resolveRules('src_1', 'kpi.degraded');
      expect(result).toEqual([rule]);
    });

    it('returns multiple matching rules in priority order', async () => {
      const r1 = { id: 'rul_1', event_pattern: 'kpi.*', priority: 100 };
      const r2 = { id: 'rul_2', event_pattern: 'kpi.degraded', priority: 50 };
      listActiveBySource.mockResolvedValue([r2, r1]); // already sorted by repo
      const result = await resolveRules('src_1', 'kpi.degraded');
      expect(result).toEqual([r2, r1]);
    });
  });

  describe('edge cases', () => {
    it('returns an empty array when no rules exist for the source', async () => {
      listActiveBySource.mockResolvedValue([]);
      const result = await resolveRules('src_none', 'alarm');
      expect(result).toEqual([]);
    });

    it('excludes rules that do not match the event type', async () => {
      const r1 = { id: 'rul_1', event_pattern: 'alarm' };
      const r2 = { id: 'rul_2', event_pattern: 'kpi.*' };
      listActiveBySource.mockResolvedValue([r1, r2]);
      const result = await resolveRules('src_1', 'alarm');
      expect(result).toEqual([r1]);
    });

    it('returns an empty array when source has rules but none match', async () => {
      listActiveBySource.mockResolvedValue([
        { id: 'rul_1', event_pattern: 'other' },
      ]);
      const result = await resolveRules('src_1', 'alarm');
      expect(result).toEqual([]);
    });
  });

  describe('error path', () => {
    it('propagates listActiveBySource errors', async () => {
      listActiveBySource.mockRejectedValue(new Error('DB error'));
      await expect(resolveRules('src_1', 'alarm')).rejects.toThrow('DB error');
    });
  });
});
