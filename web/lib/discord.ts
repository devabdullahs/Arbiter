import { prisma } from "./prisma";

const DISCORD_API = "https://discord.com/api/v10";
const ADMINISTRATOR = BigInt("8");
const MANAGE_GUILD = BigInt("32");

const BOT_PERMISSIONS =
  BigInt("16") | // Manage Channels
  BigInt("64") | // Add Reactions
  BigInt("1024") | // View Channels
  BigInt("2048") | // Send Messages
  BigInt("8192") | // Manage Messages
  BigInt("16384") | // Embed Links
  BigInt("32768") | // Attach Files
  BigInt("65536") | // Read Message History
  BigInt("262144") | // Use External Emojis
  BigInt("1048576") | // Connect
  BigInt("2097152") | // Speak
  BigInt("16777216") | // Move Members
  BigInt("268435456") | // Manage Roles
  BigInt("34359738368") | // Create Public Threads
  BigInt("68719476736") | // Create Private Threads
  BigInt("274877906944"); // Send Messages in Threads

export type DiscordGuildOption = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  manageable: boolean;
  botConfigured: boolean;
};

type DiscordGuildResponse = {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  permissions?: string;
};

function canManageGuild(permissions?: string, owner?: boolean) {
  if (owner) return true;
  if (!permissions) return false;
  const bits = BigInt(permissions);
  return (bits & ADMINISTRATOR) === ADMINISTRATOR || (bits & MANAGE_GUILD) === MANAGE_GUILD;
}

export async function listDiscordGuildOptions(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "discord" },
    select: { accessToken: true },
  });
  if (!account?.accessToken) {
    return {
      guilds: [] as DiscordGuildOption[],
      needsReconnect: true,
    };
  }

  const response = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${account.accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      guilds: [] as DiscordGuildOption[],
      needsReconnect: true,
    };
  }

  const guilds = (await response.json()) as DiscordGuildResponse[];
  const ids = guilds.map((guild) => guild.id);
  const configured = await prisma.organization.findMany({
    where: { discordGuildId: { in: ids } },
    select: { discordGuildId: true },
  });
  const configuredIds = new Set(configured.map((org) => org.discordGuildId));

  return {
    guilds: guilds
      .map((guild) => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        owner: Boolean(guild.owner),
        manageable: canManageGuild(guild.permissions, guild.owner),
        botConfigured: configuredIds.has(guild.id),
      }))
      // Only show servers where this user can actually add the bot — owner, or
      // has Manage Server / Administrator. They can't set up the rest, and the
      // card still offers a manual server-ID fallback for edge cases.
      .filter((guild) => guild.manageable)
      .sort((a, b) => a.name.localeCompare(b.name)),
    needsReconnect: false,
  };
}

export function botInviteUrl(guildId?: string | null) {
  const clientId = process.env.DISCORD_CLIENT_ID ?? "";
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("permissions", BOT_PERMISSIONS.toString());
  url.searchParams.set("scope", "bot applications.commands");
  if (guildId) {
    url.searchParams.set("guild_id", guildId);
    url.searchParams.set("disable_guild_select", "true");
  }
  return url.toString();
}
