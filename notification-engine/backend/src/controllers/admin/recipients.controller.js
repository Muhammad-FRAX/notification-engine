import { HttpError } from '../../util/HttpError.js';
import * as repo from '../../repositories/recipients.repo.js';

// ---- Users ----

export async function listUsers(req, res, next) {
  try {
    res.json(await repo.listUsers());
  } catch (err) {
    next(err);
  }
}

export async function getUser(req, res, next) {
  try {
    const user = await repo.findUserById(req.params.id);
    if (!user) return next(new HttpError(404, 'not_found', 'User not found.'));
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function createUser(req, res, next) {
  try {
    const { display_name, upn, aad_user_id, notes } = req.body ?? {};
    if (typeof display_name !== 'string' || !display_name.trim()) {
      return next(new HttpError(400, 'invalid_body', 'display_name is required.'));
    }
    if (typeof upn !== 'string' || !upn.trim()) {
      return next(new HttpError(400, 'invalid_body', 'upn is required.'));
    }
    const user = await repo.createUser({
      displayName: display_name.trim(),
      upn: upn.trim(),
      aadUserId: aad_user_id ?? null,
      notes: notes ?? null,
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req, res, next) {
  try {
    const { display_name, upn, aad_user_id, notes } = req.body ?? {};
    const updated = await repo.updateUser(req.params.id, {
      displayName: display_name ?? undefined,
      upn: upn ?? undefined,
      aadUserId: aad_user_id ?? undefined,
      notes: notes ?? undefined,
    });
    if (!updated) return next(new HttpError(404, 'not_found', 'User not found.'));
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function removeUser(req, res, next) {
  try {
    const existing = await repo.findUserById(req.params.id);
    if (!existing) return next(new HttpError(404, 'not_found', 'User not found.'));
    await repo.removeUser(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ---- Channels ----

export async function listChannels(req, res, next) {
  try {
    res.json(await repo.listChannels());
  } catch (err) {
    next(err);
  }
}

export async function getChannel(req, res, next) {
  try {
    const channel = await repo.findChannelById(req.params.id);
    if (!channel) return next(new HttpError(404, 'not_found', 'Channel not found.'));
    res.json(channel);
  } catch (err) {
    next(err);
  }
}

export async function createChannel(req, res, next) {
  try {
    const { display_name, team_id, channel_id, notes } = req.body ?? {};
    if (typeof display_name !== 'string' || !display_name.trim()) {
      return next(new HttpError(400, 'invalid_body', 'display_name is required.'));
    }
    if (typeof team_id !== 'string' || !team_id.trim()) {
      return next(new HttpError(400, 'invalid_body', 'team_id is required.'));
    }
    if (typeof channel_id !== 'string' || !channel_id.trim()) {
      return next(new HttpError(400, 'invalid_body', 'channel_id is required.'));
    }
    const channel = await repo.createChannel({
      displayName: display_name.trim(),
      teamId: team_id.trim(),
      channelId: channel_id.trim(),
      notes: notes ?? null,
    });
    res.status(201).json(channel);
  } catch (err) {
    next(err);
  }
}

export async function updateChannel(req, res, next) {
  try {
    const { display_name, notes } = req.body ?? {};
    const updated = await repo.updateChannel(req.params.id, {
      displayName: display_name ?? undefined,
      notes: notes ?? undefined,
    });
    if (!updated) return next(new HttpError(404, 'not_found', 'Channel not found.'));
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function removeChannel(req, res, next) {
  try {
    const existing = await repo.findChannelById(req.params.id);
    if (!existing) return next(new HttpError(404, 'not_found', 'Channel not found.'));
    await repo.removeChannel(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
