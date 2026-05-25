import { HttpError } from '../../util/HttpError.js';
import * as repo from '../../repositories/groups.repo.js';

export async function list(req, res, next) {
  try {
    res.json(await repo.listGroups());
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const group = await repo.findGroupById(req.params.id);
    if (!group) return next(new HttpError(404, 'not_found', 'Group not found.'));
    const members = await repo.listMembers(req.params.id);
    res.json({ ...group, members });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const { name, description } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
      return next(new HttpError(400, 'invalid_body', 'name is required.'));
    }
    const group = await repo.createGroup({ name: name.trim(), description: description ?? null });
    res.status(201).json(group);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const { name, description } = req.body ?? {};
    const updated = await repo.updateGroup(req.params.id, {
      name: name ?? undefined,
      description: description ?? undefined,
    });
    if (!updated) return next(new HttpError(404, 'not_found', 'Group not found.'));
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const existing = await repo.findGroupById(req.params.id);
    if (!existing) return next(new HttpError(404, 'not_found', 'Group not found.'));
    await repo.removeGroup(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function addMember(req, res, next) {
  try {
    const group = await repo.findGroupById(req.params.id);
    if (!group) return next(new HttpError(404, 'not_found', 'Group not found.'));

    const { member_type, member_id } = req.body ?? {};
    if (!['user', 'channel'].includes(member_type)) {
      return next(new HttpError(400, 'invalid_body', 'member_type must be "user" or "channel".'));
    }
    if (typeof member_id !== 'string' || !member_id.trim()) {
      return next(new HttpError(400, 'invalid_body', 'member_id is required.'));
    }

    const member = await repo.addMember({
      groupId: req.params.id,
      memberType: member_type,
      memberId: member_id.trim(),
    });
    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req, res, next) {
  try {
    const group = await repo.findGroupById(req.params.id);
    if (!group) return next(new HttpError(404, 'not_found', 'Group not found.'));

    const { memberType, memberId } = req.params;
    if (!['user', 'channel'].includes(memberType)) {
      return next(new HttpError(400, 'invalid_param', 'memberType must be "user" or "channel".'));
    }

    await repo.removeMember(req.params.id, memberType, memberId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
