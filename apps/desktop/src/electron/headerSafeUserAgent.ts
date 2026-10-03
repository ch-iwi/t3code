/**
 * Reduce a User-Agent to printable ASCII so it survives `new Headers()`.
 *
 * Electron builds its default User-Agent from the app name. The desktop
 * protocol proxy copies renderer request headers into `Headers`, which rejects
 * anything outside Latin-1, so a display name like "DV³ Code" would fail every
 * proxied request. Compatibility decomposition keeps the intent ("³" -> "3").
 */
export function toHeaderSafeUserAgent(userAgent: string): string {
  return userAgent.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
}
