import { HttpError } from '../../util/HttpError.js';
import * as repo from '../../repositories/rules.repo.js';

export async function list(req, res, next) {
  try {
    const sourceId = req.query.source_id ?? null;
    const rules = await repo.listRules({ sourceId: sourceId || null });
    res.json(rules);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const rule = await repo.findById(req.params.id);
    if (!rule) return next(new HttpError(404, 'not_found', 'Rule not found.'));
    res.json(rule);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const { source_id, event_pattern, group_id, template_id, priority } = req.body ?? {};
    if (typeof source_id !== 'string' || !source_id.trim()) {
      return next(new HttpError(400, 'invalid_body', 'source_id is required.'));
    }
    if (typeof event_pattern !== 'string' || !event_pattern.trim()) {
      return next(new HttpError(400, 'invalid_body', 'event_pattern is required.'));
    }
    if (typeof group_id !== 'string' || !group_id.trim()) {
      return next(new HttpError(400, 'invalid_body', 'group_id is required.'));
    }
    const rule = await repo.create({
      sourceId: source_id.trim(),
      eventPattern: event_pattern.trim(),
      groupId: group_id.trim(),
      templateId: template_id ?? null,
      priority: typeof priority === 'number' ? priority : undefined,
    });
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const { event_pattern, group_id, template_id, priority, active } = req.body ?? {};
    const updated = await repo.update(req.params.id, {
      eventPattern: event_pattern ?? undefined,
      groupId: group_id ?? undefined,
      templateId: template_id ?? undefined,
      priority: priority ?? undefined,
      active: active ?? undefined,
    });
    if (!updated) return next(new HttpError(404, 'not_found', 'Rule not found.'));
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const existing = await repo.findById(req.params.id);
    if (!existing) return next(new HttpError(404, 'not_found', 'Rule not found.'));
    await repo.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
