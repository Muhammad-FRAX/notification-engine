import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/templates.repo.js', () => ({
  findById: vi.fn(),
}));

import { findById } from '../repositories/templates.repo.js';
import { getEffectiveTemplate, renderTemplate } from '../services/template.service.js';

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// getEffectiveTemplate
// ---------------------------------------------------------------------------

describe('getEffectiveTemplate', () => {
  it('returns the default template when templateId is null', async () => {
    const tpl = await getEffectiveTemplate(null);
    expect(tpl.id).toBeNull();
    expect(tpl.name).toBe('__default__');
  });

  it('returns the default template when templateId is undefined', async () => {
    const tpl = await getEffectiveTemplate(undefined);
    expect(tpl.id).toBeNull();
  });

  it('returns the DB row when the template exists', async () => {
    const row = { id: 'tpl_1', name: 'My Template', kind: 'text_html', body: '{{title}}', vars_schema: null };
    findById.mockResolvedValue(row);
    const result = await getEffectiveTemplate('tpl_1');
    expect(result).toEqual(row);
    expect(findById).toHaveBeenCalledWith('tpl_1');
  });

  it('falls back to default when the DB row no longer exists', async () => {
    findById.mockResolvedValue(null);
    const tpl = await getEffectiveTemplate('tpl_gone');
    expect(tpl.id).toBeNull();
  });

  it('propagates DB errors', async () => {
    findById.mockRejectedValue(new Error('DB timeout'));
    await expect(getEffectiveTemplate('tpl_1')).rejects.toThrow('DB timeout');
  });
});

// ---------------------------------------------------------------------------
// renderTemplate — pure logic, no DB calls needed
// ---------------------------------------------------------------------------

describe('renderTemplate', () => {
  const textHtmlTemplate = {
    id: 'tpl_1',
    kind: 'text_html',
    body: '<p>{{title}}</p><p>{{body}}</p>',
    vars_schema: null,
  };

  const cardTemplate = {
    id: 'tpl_2',
    kind: 'adaptive_card',
    body: '{"type":"AdaptiveCard","body":[{"type":"TextBlock","text":"{{title}}"}]}',
    vars_schema: null,
  };

  describe('happy path — text_html', () => {
    it('substitutes vars and returns htmlBody', () => {
      const { htmlBody, attachments, hostedContents } = renderTemplate(
        textHtmlTemplate,
        { title: 'Alert', body: 'Systems down' },
      );
      expect(htmlBody).toBe('<p>Alert</p><p>Systems down</p>');
      expect(attachments).toHaveLength(0);
      expect(hostedContents).toHaveLength(0);
    });
  });

  describe('happy path — adaptive_card', () => {
    it('renders card JSON and wraps htmlBody in <attachment>', () => {
      const { htmlBody, attachments } = renderTemplate(
        cardTemplate,
        { title: 'KPI degraded' },
      );
      expect(htmlBody).toBe('<attachment id="1"></attachment>');
      expect(attachments).toHaveLength(1);
      expect(attachments[0].contentType).toBe('application/vnd.microsoft.card.adaptive');
      expect(attachments[0].content).toContain('KPI degraded');
    });
  });

  describe('happy path — inbound image attachments', () => {
    it('appends hostedContents entries and img tags for kind=image attachments', () => {
      const { htmlBody, hostedContents } = renderTemplate(
        textHtmlTemplate,
        { title: 'Chart' },
        [{ kind: 'image', base64: 'abc==', mimeType: 'image/png' }],
      );
      expect(hostedContents).toHaveLength(1);
      expect(hostedContents[0]).toMatchObject({ tempId: '1', base64: 'abc==', mimeType: 'image/png' });
      expect(htmlBody).toContain('<img src="../hostedContents/1/$value"');
    });

    it('indexes multiple inbound images sequentially', () => {
      const { hostedContents } = renderTemplate(
        textHtmlTemplate,
        {},
        [
          { kind: 'image', base64: 'img1==', mimeType: 'image/png' },
          { kind: 'image', base64: 'img2==', mimeType: 'image/jpeg' },
        ],
      );
      expect(hostedContents[0].tempId).toBe('1');
      expect(hostedContents[1].tempId).toBe('2');
    });

    it('skips attachments that are not kind=image', () => {
      const { hostedContents } = renderTemplate(
        textHtmlTemplate,
        {},
        [{ kind: 'file', base64: 'pdf==' }],
      );
      expect(hostedContents).toHaveLength(0);
    });
  });

  describe('vars_schema validation', () => {
    const strictTemplate = {
      id: 'tpl_3',
      kind: 'text_html',
      body: '{{title}}',
      vars_schema: { required: ['title', 'data.kpi'] },
    };

    it('passes when all required fields are present', () => {
      expect(() =>
        renderTemplate(strictTemplate, { title: 'X', data: { kpi: '12%' } }),
      ).not.toThrow();
    });

    it('throws template_validation when a required top-level field is missing', () => {
      try {
        renderTemplate(strictTemplate, { data: { kpi: '12%' } });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.code).toBe('template_validation');
        expect(err.message).toContain('title');
      }
    });

    it('throws template_validation when a required nested field is missing', () => {
      try {
        renderTemplate(strictTemplate, { title: 'X', data: {} });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.code).toBe('template_validation');
        expect(err.message).toContain('data.kpi');
      }
    });

    it('accepts a JSON-string vars_schema (as might come from non-pg path)', () => {
      const tpl = { ...strictTemplate, vars_schema: JSON.stringify({ required: ['title'] }) };
      expect(() => renderTemplate(tpl, { title: 'ok' })).not.toThrow();
    });
  });
});
