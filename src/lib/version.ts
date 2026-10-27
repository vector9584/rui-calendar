/**
 * Compare two semver strings (with optional leading `v`).
 * Returns: -1 if a < b, 0 if equal, 1 if a > b.
 *
 * Delegates to the `semver` package, which handles pre-release tags and
 * build metadata correctly (unlike a hand-rolled major/minor/patch compare).
 */
import semver from 'semver'

function toSemver(value: string): semver.SemVer | null {
  const stripped = value.replace(/^v/, '')
  return semver.parse(stripped) ?? semver.coerce(stripped)
}

export function compareVersions(a: string, b: string): number {
  const sa = toSemver(a)
  const sb = toSemver(b)
  if (sa && sb) {
    return sa.compare(sb)
  }
  // Fall back to a stable string compare if either side is not parseable.
  return a === b ? 0 : a < b ? -1 : 1
}
