import { matchPanelPayload, playerMatchPayload, teamMatchPayload } from '../ui/match-panel.js';
import { setPlayerMessage, setTeamRoomMessages } from '../services/match-service.js';

export async function updateMatchMessages(client, match, options = {}) {
  const updateControl = options.control ?? true;
  const updatePlayer = options.player ?? true;
  const updateTeamRooms = options.teamRooms ?? true;
  const updates = [];

  if (updateControl) updates.push(updateControlMessage(client, match));
  if (updatePlayer) updates.push(updatePlayerMessage(client, match));
  if (updateTeamRooms) updates.push(updateTeamRoomMessages(client, match));

  await Promise.all(updates);
}

async function updateTeamRoomMessages(client, match) {
  const updates = await Promise.all([
    updateTeamRoomMessage(client, match, 'team_a'),
    updateTeamRoomMessage(client, match, 'team_b'),
  ]);
  const messageUpdates = Object.assign({}, ...updates.filter(Boolean));

  if (Object.keys(messageUpdates).length) {
    await setTeamRoomMessages(match.id, messageUpdates).catch(() => null);
  }
}

async function updateTeamRoomMessage(client, match, teamSlot) {
  const isTeamA = teamSlot === 'team_a';
  const channelId = isTeamA ? match.room?.teamATextChannelId : match.room?.teamBTextChannelId;
  const messageId = isTeamA ? match.room?.teamAMessageId : match.room?.teamBMessageId;

  if (!channelId) {
    return null;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return null;
  }

  const message = messageId
    ? await channel.messages.fetch(messageId).catch(() => null)
    : await findExistingBotMatchMessage(client, channel, match);

  const sent = message
    ? await message.edit(teamMatchPayload(match, teamSlot)).catch(() => null)
    : await channel.send(teamMatchPayload(match, teamSlot)).catch(() => null);

  if (!sent) {
    return null;
  }

  return isTeamA ? { teamAMessageId: sent.id } : { teamBMessageId: sent.id };
}

async function findExistingBotMatchMessage(client, channel, match) {
  const messages = await channel.messages.fetch({ limit: 25 }).catch(() => null);
  return (
    messages?.find((candidate) => {
      if (candidate.author?.id !== client.user?.id) return false;
      return JSON.stringify(candidate.components ?? []).includes(match.id);
    }) ?? null
  );
}

async function updateControlMessage(client, match) {
  if (!match.channelId || !match.controlMessageId) {
    return;
  }

  const channel = await client.channels.fetch(match.channelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return;
  }

  const message = await channel.messages.fetch(match.controlMessageId).catch(() => null);
  await message?.edit(matchPanelPayload(match)).catch(() => null);
}

async function updatePlayerMessage(client, match) {
  if (!match.room?.textChannelId) {
    return;
  }

  const channel = await client.channels.fetch(match.room.textChannelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return;
  }

  const message = match.room.playerMessageId
    ? await channel.messages.fetch(match.room.playerMessageId).catch(() => null)
    : await findExistingPlayerMessage(client, channel, match);

  await message?.edit(playerMatchPayload(match)).catch(() => null);
}

async function findExistingPlayerMessage(client, channel, match) {
  const messages = await channel.messages.fetch({ limit: 25 }).catch(() => null);
  const message = messages?.find((candidate) => {
    if (candidate.author?.id !== client.user?.id) return false;
    return JSON.stringify(candidate.components ?? []).includes(match.id);
  });

  if (message) {
    await setPlayerMessage(match.id, message.id).catch(() => null);
  }

  return message ?? null;
}
