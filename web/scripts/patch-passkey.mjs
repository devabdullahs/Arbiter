// Build-time fix for a @better-auth/passkey (1.6.x) bug.
//
// The plugin builds WebAuthn credential descriptors as { id, transports } and
// omits the spec-required `type: "public-key"`. Chrome tolerates the omission;
// iOS Safari rejects it with a raw `TypeError`, so passkey REGISTRATION fails on
// iPhone whenever the account already has a passkey (excludeCredentials is then
// populated). We inject the missing field into both the excludeCredentials
// (register) and allowCredentials (authenticate) descriptor maps.
//
// Idempotent: once patched, the bare `({ id: ... })` shape no longer exists, so
// re-running is a no-op. Runs from `build`/`predev` so it applies in local dev
// and inside the Docker/CI image build.
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

const pattern = /(userPasskeys\.map\(\(passkey\) => \(\{)(\s*)(id: passkey\.credentialID,)/g;
const matches = source.match(pattern)?.length ?? 0;

if (matches === 0) {
  if (/userPasskeys\.map\(\(passkey\) => \(\{\s*type: "public-key",/.test(source)) {
    console.log("[patch-passkey] already applied.");
  } else {
    console.warn(
      "[patch-passkey] credential descriptor maps not found — @better-auth/passkey may have changed upstream; verify the passkey type fix is still needed.",
    );
  }
  process.exit(0);
}

writeFileSync(target, source.replace(pattern, '$1$2type: "public-key",$2$3'));
console.log(
  `[patch-passkey] injected type:"public-key" into ${matches} credential descriptor map(s).`,
);
