import { listMembers } from '../repositories/groups.repo.js';
import { findUserById, findChannelById } from '../repositories/recipients.repo.js';

/**
 * Expands a group into a flat list of resolved recipient objects.
 * Each entry: { type: 'user' | 'channel', id: string, details: row }
 *
 * Members whose backing row no longer exists are silently skipped.
 */
export async function expandGroup(groupId) {
  const members = await listMembers(groupId);
  const recipients = [];

  for (const member of members) {
    if (member.member_type === 'user') {
      const user = await findUserById(member.member_id);
      if (user) {
        recipients.push({ type: 'user', id: member.member_id, details: user });
      }
    } else if (member.member_type === 'channel') {
      const channel = await findChannelById(member.member_id);
      if (channel) {
        recipients.push({ type: 'channel', id: member.member_id, details: channel });
      }
    }
  }

  return recipients;
}
