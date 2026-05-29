export const siteName = "Arbiter";

export const siteDescription =
  "Discord esports referee and tournament operations platform for match panels, BR lobbies, check-ins, evidence, audit logs, and referee workflows. Available as a hosted service or open-source self-hosted code.";

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
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
