import { matchPanelPayload, playerMatchPayload } from '../ui/match-panel.js';
import { setPlayerMessage } from '../services/match-service.js';

export async function updateMatchMessages(client, match, options = {}) {
  const updateControl = options.control ?? true;
  const updatePlayer = options.player ?? true;
  const updates = [];

  if (updateControl) updates.push(updateControlMessage(client, match));
  if (updatePlayer) updates.push(updatePlayerMessage(client, match));

  await Promise.all(updates);
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
