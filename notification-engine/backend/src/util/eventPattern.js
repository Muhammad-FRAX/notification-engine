/**
 * Returns true if eventType matches pattern.
 * Supports exact match or a single trailing wildcard:
 *   'kpi.*'  matches 'kpi.degraded', 'kpi.recovered', etc.
 *   'alarm'  matches only 'alarm'
 * No regex, no multi-segment wildcards.
 */
export function matchEventPattern(pattern, eventType) {
  if (typeof pattern !== 'string' || typeof eventType !== 'string') return false;
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return eventType.startsWith(prefix);
  }
  return pattern === eventType;
}
