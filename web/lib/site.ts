export const siteName = "Arbiter";

export const siteDescription =
  "Self-hosted Discord esports referee and tournament operations bot for match panels, BR lobbies, check-ins, evidence, audit logs, and referee workflows.";

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.BETTER_AUTH_URL ??
  "https://arbiter.moonbot.info"
).replace(/\/$/, "");

export const siteKeywords = [
  "Arbiter",
  "Discord esports bot",
  "esports referee bot",
  "tournament operations",
  "match management",
  "battle royale scoring",
  "map veto",
  "evidence vault",
  "referee dashboard",
  "self-hosted Discord bot",
];
