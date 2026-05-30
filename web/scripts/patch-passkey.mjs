// Build-time fixes for two @better-auth/passkey (1.6.x) bugs that break passkeys
// on iOS Safari (Chrome silently tolerates both):
//
// 1. Credential descriptors omit the spec-required `type: "public-key"`.
// 2. `transports` is stored as a comma string and emitted via `.split(",")`.
//    A key saved with empty transports (e.g. some USB security keys) becomes
//    `[""]`, and "" is not a valid AuthenticatorTransport — Safari rejects the
//    whole ceremony with a raw `TypeError`. We filter empties out.
//
// Both edits are idempotent (re-running is a no-op) and target the
// excludeCredentials (register), allowCredentials (authenticate), and the
// server-side verification descriptor. Wired via prebuild/predev so the fix
// applies in local dev and inside the Docker/CI image build.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const target = fileURLToPath(
  new URL("../node_modules/@better-auth/passkey/dist/index.mjs", import.meta.url),
);

let source;
try {
  source = readFileSync(target, "utf8");
} catch {
  console.warn("[patch-passkey] @better-auth/passkey not installed; skipping.");
  process.exit(0);
}

const original = source;

// Fix 1: inject `type: "public-key"` into the credential descriptor maps.
const typePattern = /(userPasskeys\.map\(\(passkey\) => \(\{)(\s*)(id: passkey\.credentialID,)/g;
const typeMatches = source.match(typePattern)?.length ?? 0;
source = source.replace(typePattern, '$1$2type: "public-key",$2$3');

// Fix 2: drop empty/invalid transports (`"".split(",")` -> `[""]`). The negative
// lookahead keeps this idempotent (won't re-wrap an already-filtered call).
const transportsPattern = /passkey\.transports\?\.split\(","\)(?!\.filter)/g;
const transportsMatches = source.match(transportsPattern)?.length ?? 0;
source = source.replace(transportsPattern, 'passkey.transports?.split(",").filter(Boolean)');

if (source === original) {
  const alreadyTyped = /userPasskeys\.map\(\(passkey\) => \(\{\s*type: "public-key",/.test(source);
  const alreadyFiltered = /passkey\.transports\?\.split\(","\)\.filter\(Boolean\)/.test(source);
  if (alreadyTyped && alreadyFiltered) {
    console.log("[patch-passkey] already applied.");
  } else {
    console.warn(
      "[patch-passkey] nothing matched — @better-auth/passkey may have changed upstream; verify the passkey fixes are still needed.",
    );
  }
  process.exit(0);
}

writeFileSync(target, source);
console.log(
  `[patch-passkey] applied: type:"public-key" x${typeMatches}, transports filter x${transportsMatches}.`,
);
