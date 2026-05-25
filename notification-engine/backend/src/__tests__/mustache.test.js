import { describe, it, expect } from 'vitest';
import { render } from '../util/mustache.js';

describe('render', () => {
  describe('happy path', () => {
    it('substitutes a top-level variable', () => {
      expect(render('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
    });

    it('substitutes a dot-notation path', () => {
      expect(render('KPI: {{data.kpi}}', { data: { kpi: '42%' } })).toBe('KPI: 42%');
    });

    it('substitutes multiple placeholders in one template', () => {
      const result = render('{{title}} — {{body}}', { title: 'Alert', body: 'Systems down' });
      expect(result).toBe('Alert — Systems down');
    });

    it('substitutes a deeply nested path', () => {
      const result = render('{{a.b.c}}', { a: { b: { c: 'deep' } } });
      expect(result).toBe('deep');
    });

    it('coerces numbers to strings', () => {
      expect(render('Count: {{count}}', { count: 99 })).toBe('Count: 99');
    });

    it('ignores whitespace around placeholder keys', () => {
      expect(render('{{ name }}', { name: 'trimmed' })).toBe('trimmed');
    });
  });

  describe('edge cases', () => {
    it('replaces missing top-level key with empty string', () => {
      expect(render('Hi {{missing}}', {})).toBe('Hi ');
    });

    it('replaces missing nested path with empty string', () => {
      expect(render('{{data.nope}}', { data: {} })).toBe('');
    });

    it('replaces null value with empty string', () => {
      expect(render('{{val}}', { val: null })).toBe('');
    });

    it('replaces undefined value with empty string', () => {
      expect(render('{{val}}', { val: undefined })).toBe('');
    });

    it('returns template unchanged when no placeholders present', () => {
      expect(render('<p>Hello</p>', {})).toBe('<p>Hello</p>');
    });

    it('handles empty template string', () => {
      expect(render('', { x: 1 })).toBe('');
    });

    it('handles a vars object with no properties', () => {
      expect(render('{{a}} {{b}}', {})).toBe(' ');
    });
  });

  describe('error path', () => {
    it('returns empty string when template is not a string', () => {
      expect(render(null, {})).toBe('');
      expect(render(undefined, {})).toBe('');
    });

    it('does not throw when vars is null', () => {
      expect(() => render('{{x}}', null)).not.toThrow();
    });
  });
});
