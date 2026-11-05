/**
 * Tiny string helpers shared by config/routes.
 *
 * Why a loop instead of `/\/+$/`: a backtracking regex on a long run of
 * slashes is super-linear (Sonar S8786 / possible ReDoS). This is O(n).
 */
export function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 0x2f /* '/' */) {
    end--;
  }
  return value.slice(0, end);
}
