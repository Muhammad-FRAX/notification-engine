import { randomBytes } from 'node:crypto';
import { HttpError } from '../../util/HttpError.js';
import { hashApiKey } from '../../util/hash.js';
import * as repo from '../../repositories/sources.repo.js';

function generateApiKey() {
  return randomBytes(32).toString('hex');
}

export async function list(req, res, next) {
  try {
    const sources = await repo.findAll();
    res.json(sources);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const source = await repo.findById(req.params.id);
    if (!source) return next(new HttpError(404, 'not_found', 'Source not found.'));
    res.json(source);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const { name, rate_limit_rpm } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
      return next(new HttpError(400, 'invalid_body', 'name is required.'));
    }

    const plainKey = generateApiKey();
    const apiKeyPrefix = plainKey.slice(0, 8);
    const apiKeyHash = await hashApiKey(plainKey);

    const source = await repo.create({
      name: name.trim(),
      apiKeyHash,
      apiKeyPrefix,
      rateLimitRpm: typeof rate_limit_rpm === 'number' ? rate_limit_rpm : undefined,
    });

    res.status(201).json({ ...source, api_key: plainKey });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const { name, rate_limit_rpm, active } = req.body ?? {};
    const updated = await repo.update(req.params.id, {
      name: name ?? undefined,
      rateLimitRpm: rate_limit_rpm ?? undefined,
      active: active ?? undefined,
    });
    if (!updated) return next(new HttpError(404, 'not_found', 'Source not found.'));
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const existing = await repo.findById(req.params.id);
    if (!existing) return next(new HttpError(404, 'not_found', 'Source not found.'));
    await repo.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
