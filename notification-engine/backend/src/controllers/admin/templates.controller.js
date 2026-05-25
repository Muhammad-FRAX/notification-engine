import { HttpError } from '../../util/HttpError.js';
import * as repo from '../../repositories/templates.repo.js';
import { renderTemplate } from '../../services/template.service.js';

const VALID_KINDS = ['text_html', 'image', 'adaptive_card'];

export async function list(req, res, next) {
  try {
    res.json(await repo.listTemplates());
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const template = await repo.findById(req.params.id);
    if (!template) return next(new HttpError(404, 'not_found', 'Template not found.'));
    res.json(template);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const { name, kind, body, vars_schema } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
      return next(new HttpError(400, 'invalid_body', 'name is required.'));
    }
    if (!VALID_KINDS.includes(kind)) {
      return next(new HttpError(400, 'invalid_body', `kind must be one of: ${VALID_KINDS.join(', ')}.`));
    }
    if (typeof body !== 'string' || !body.trim()) {
      return next(new HttpError(400, 'invalid_body', 'body is required.'));
    }
    const template = await repo.create({
      name: name.trim(),
      kind,
      body: body.trim(),
      varsSchema: vars_schema ?? null,
    });
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const { name, kind, body, vars_schema, active } = req.body ?? {};
    if (kind !== undefined && !VALID_KINDS.includes(kind)) {
      return next(new HttpError(400, 'invalid_body', `kind must be one of: ${VALID_KINDS.join(', ')}.`));
    }
    const updated = await repo.update(req.params.id, {
      name: name ?? undefined,
      kind: kind ?? undefined,
      body: body ?? undefined,
      varsSchema: vars_schema ?? undefined,
      active: active ?? undefined,
    });
    if (!updated) return next(new HttpError(404, 'not_found', 'Template not found.'));
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const existing = await repo.findById(req.params.id);
    if (!existing) return next(new HttpError(404, 'not_found', 'Template not found.'));
    await repo.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function preview(req, res, next) {
  try {
    const template = await repo.findById(req.params.id);
    if (!template) return next(new HttpError(404, 'not_found', 'Template not found.'));

    const vars = req.body?.vars ?? {};
    const attachments = req.body?.attachments ?? [];

    try {
      const rendered = renderTemplate(template, vars, attachments);
      res.json(rendered);
    } catch (renderErr) {
      if (renderErr.code === 'template_validation') {
        return next(new HttpError(422, 'template_validation', renderErr.message));
      }
      throw renderErr;
    }
  } catch (err) {
    next(err);
  }
}
