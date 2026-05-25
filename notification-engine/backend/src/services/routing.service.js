import { listActiveBySource } from '../repositories/rules.repo.js';
import { matchEventPattern } from '../util/eventPattern.js';

/**
 * Returns the ordered list of active routing rules whose event_pattern matches
 * the given eventType for the given source.
 *
 * Rules are pre-sorted by priority ASC in the repo query, so the first entry
 * has the highest precedence.
 */
export async function resolveRules(sourceId, eventType) {
  const rules = await listActiveBySource(sourceId);
  return rules.filter((rule) => matchEventPattern(rule.event_pattern, eventType));
}
