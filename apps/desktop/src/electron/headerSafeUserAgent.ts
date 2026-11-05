/**
 * Reduces a User-Agent to printable ASCII. Electron builds it from the app name, and the
 * desktop proxy's `Headers` rejects non-Latin-1 values such as "DV³" ("³" becomes "3").
 */
export function toHeaderSafeUserAgent(userAgent: string): string {
  return userAgent.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
}
