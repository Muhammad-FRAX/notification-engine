import { ulid } from 'ulid';

export function generateId(prefix) {
  return `${prefix}${ulid()}`;
}
