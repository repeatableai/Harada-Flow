/**
 * DCE Mode Resolution
 *
 * Three-layer resolution order:
 *   1. Per-deliverable escalate flag (highest priority)
 *   2. Session-level override
 *   3. Global user preference (lowest priority)
 *
 * Returns: 'Working' | 'Executive' | 'AskEverySession'
 */

export function resolveMode({ userPref = 'Working', sessionOverride = null, escalateFlag = false }) {
  // Escalate always wins — routes to Executive for this single deliverable
  if (escalateFlag) {
    return 'Executive';
  }

  // Session override takes precedence over global pref (if set and not 'inherit')
  if (sessionOverride && sessionOverride !== 'inherit') {
    return sessionOverride;
  }

  // Fall back to global user preference
  return userPref || 'Working';
}
