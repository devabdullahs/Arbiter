import { ChannelType } from 'discord.js';

import { brStandingsPayload, brTeamRoomPayload } from '../ui/br-panel.js';

export async function updateBrMessages(client, lobby) {
  if (!lobby?.channelId || !lobby.controlMessageId) return;

  const channel = await client.channels.fetch(lobby.channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return;

  const message = await channel.messages.fetch(lobby.controlMessageId).catch(() => null);
  await message?.edit(brStandingsPayload(lobby)).catch(() => null);

  await Promise.all(
    (lobby.teams ?? []).map(async (team) => {
      if (!team.textChannelId || !team.teamMessageId) return;

      const teamChannel = await client.channels.fetch(team.textChannelId).catch(() => null);
      if (!teamChannel?.isTextBased?.() || teamChannel.type === ChannelType.DM) return;

      const teamMessage = await teamChannel.messages.fetch(team.teamMessageId).catch(() => null);
      await teamMessage?.edit(brTeamRoomPayload(lobby, team)).catch(() => null);
    }),
  );
}
