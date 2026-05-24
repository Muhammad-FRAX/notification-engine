import { describe, it, expect } from 'vitest';
import { generateId } from '../util/ulid.js';

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

describe('generateId', () => {
  it('happy path: prepends the prefix to a valid ULID', () => {
    const id = generateId('ntf_');
    expect(id.startsWith('ntf_')).toBe(true);
    expect(ULID_RE.test(id.slice('ntf_'.length))).toBe(true);
  });

  it('edge case: empty prefix returns just the ULID', () => {
    const id = generateId('');
    expect(id).toHaveLength(26);
    expect(ULID_RE.test(id)).toBe(true);
  });

  it('uniqueness: consecutive calls produce distinct ids', () => {
    const a = generateId('src_');
    const b = generateId('src_');
    expect(a).not.toBe(b);
  });
});
