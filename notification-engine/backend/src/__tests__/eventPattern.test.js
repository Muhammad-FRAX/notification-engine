import { describe, it, expect } from 'vitest';
import { matchEventPattern } from '../util/eventPattern.js';

describe('matchEventPattern', () => {
  describe('happy path — exact match', () => {
    it('returns true for an identical string', () => {
      expect(matchEventPattern('alarm', 'alarm')).toBe(true);
    });

    it('returns false when event type differs', () => {
      expect(matchEventPattern('alarm', 'alert')).toBe(false);
    });

    it('returns false for a prefix without wildcard', () => {
      expect(matchEventPattern('kpi', 'kpi.degraded')).toBe(false);
    });
  });

  describe('happy path — wildcard', () => {
    it('matches a child event type with trailing wildcard', () => {
      expect(matchEventPattern('kpi.*', 'kpi.degraded')).toBe(true);
    });

    it('matches another child event type with the same prefix', () => {
      expect(matchEventPattern('kpi.*', 'kpi.recovered')).toBe(true);
    });

    it('matches a bare wildcard (*) against any event type', () => {
      expect(matchEventPattern('*', 'anything.at.all')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('does not match a sibling prefix with wildcard', () => {
      expect(matchEventPattern('kpi.*', 'kpix.degraded')).toBe(false);
    });

    it('wildcard pattern with just the prefix matches child but not the prefix alone', () => {
      expect(matchEventPattern('kpi.*', 'kpi')).toBe(false);
    });

    it('wildcard matches an event type that exactly equals the prefix segment', () => {
      expect(matchEventPattern('kpi.*', 'kpi.')).toBe(true);
    });

    it('exact match is case-sensitive', () => {
      expect(matchEventPattern('Alarm', 'alarm')).toBe(false);
    });
  });

  describe('error path', () => {
    it('returns false when pattern is not a string', () => {
      expect(matchEventPattern(null, 'alarm')).toBe(false);
      expect(matchEventPattern(undefined, 'alarm')).toBe(false);
      expect(matchEventPattern(42, 'alarm')).toBe(false);
    });

    it('returns false when eventType is not a string', () => {
      expect(matchEventPattern('alarm', null)).toBe(false);
      expect(matchEventPattern('alarm', undefined)).toBe(false);
    });

    it('does not throw for empty strings', () => {
      expect(matchEventPattern('', '')).toBe(true);
      expect(matchEventPattern('', 'alarm')).toBe(false);
    });
  });
});
