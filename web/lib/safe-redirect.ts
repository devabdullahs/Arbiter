// Guards against open-redirect / phishing: only allow same-site absolute paths.
//
// An attacker who controls a post-auth redirect target (e.g. ?callbackURL= or a
// returnTo form field) can bounce a freshly-authenticated user to an external
// site. We only accept values that are a single-leading-slash relative path and
// reject protocol-relative ("//evil.com"), backslash ("/\\evil.com"), and
// control-character tricks. Anything else falls back to a known-safe path.
export function safeRelativePath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (typeof value !== "string" || value.length === 0) return fallback;
  // Must be an absolute path on this origin.
  if (value[0] !== "/") return fallback;
  // "//host" and "/\host" are treated as network paths by browsers/URL parsers.
  if (value[1] === "/" || value[1] === "\\") return fallback;
  // Reject control chars / spaces (code <= 0x20 or DEL); a legitimate path would
  // percent-encode them, so their presence signals a smuggling attempt.
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return fallback;
  }
  return value;
}
