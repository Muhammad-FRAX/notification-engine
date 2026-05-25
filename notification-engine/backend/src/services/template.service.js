import { findById as findTemplate } from '../repositories/templates.repo.js';
import { render } from '../util/mustache.js';

const DEFAULT_TEMPLATE = {
  id: null,
  name: '__default__',
  kind: 'text_html',
  body: '<p><strong>[{{event_type}}]</strong> {{title}}</p><p>{{body}}</p>',
  vars_schema: null,
};

/**
 * Returns the template row for the given id, or the built-in default if the id
 * is null/undefined or the row no longer exists.
 */
export async function getEffectiveTemplate(templateId) {
  if (!templateId) return DEFAULT_TEMPLATE;
  const tpl = await findTemplate(templateId);
  return tpl ?? DEFAULT_TEMPLATE;
}

/**
 * Checks that every field listed in vars_schema.required is present and non-null
 * in vars. Returns an error message string on failure, null on success.
 */
function validateVarsSchema(schema, vars) {
  if (!schema) return null;
  const parsed = typeof schema === 'string' ? JSON.parse(schema) : schema;
  if (Array.isArray(parsed.required)) {
    for (const field of parsed.required) {
      const value = field.split('.').reduce((obj, k) => (obj != null ? obj[k] : undefined), vars);
      if (value === undefined || value === null) {
        return `Required field missing: ${field}`;
      }
    }
  }
  return null;
}

/**
 * Renders a template against payload vars and composes the Graph API structures.
 *
 * Returns { htmlBody, attachments, hostedContents } where:
 *   htmlBody        — the HTML string for body.content
 *   attachments     — Graph attachment objects (non-empty only for adaptive_card)
 *   hostedContents  — Graph hostedContent objects built from inboundAttachments
 *
 * Throws an error with err.code === 'template_validation' when vars_schema
 * validation fails. The caller should catch this and mark the delivery failed.
 *
 * inboundAttachments: the payload.attachments array ({ kind, base64, mimeType? }).
 *   Only entries with kind === 'image' are processed.
 */
export function renderTemplate(template, vars, inboundAttachments = []) {
  const validationError = validateVarsSchema(template.vars_schema, vars);
  if (validationError) {
    const err = new Error(validationError);
    err.code = 'template_validation';
    throw err;
  }

  let htmlBody = '';
  const attachments = [];
  const hostedContents = [];

  if (template.kind === 'adaptive_card') {
    const cardJson = render(template.body, vars);
    const cardId = '1';
    attachments.push({
      id: cardId,
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: cardJson,
    });
    htmlBody = `<attachment id="${cardId}"></attachment>`;
  } else {
    // text_html or image — render body directly
    htmlBody = render(template.body, vars);
  }

  // Append inbound image attachments as Graph hostedContents
  let hcIndex = hostedContents.length + 1;
  for (const att of inboundAttachments) {
    if (att.kind === 'image' && att.base64) {
      const tempId = String(hcIndex++);
      hostedContents.push({ tempId, base64: att.base64, mimeType: att.mimeType || 'image/png' });
      htmlBody += `<img src="../hostedContents/${tempId}/$value" />`;
    }
  }

  return { htmlBody, attachments, hostedContents };
}
