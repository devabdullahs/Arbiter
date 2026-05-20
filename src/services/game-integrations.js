export async function validateRosterAccount({ gameAccount }) {
  return {
    ok: Boolean(gameAccount?.trim()),
    provider: 'manual',
    reason: gameAccount?.trim() ? 'Account recorded for later API validation.' : 'Missing game account.',
  };
}

export async function fetchAutomatedMatchResult() {
  return {
    available: false,
    reason: 'No game API provider is configured yet.',
  };
}
