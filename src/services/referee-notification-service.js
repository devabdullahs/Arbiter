import { getOnShiftRefereeIds } from './referee-service.js';

export async function getRefereeRequestTargets(match) {
  if (match.assignedRefereeId) {
    return [match.assignedRefereeId];
  }

  return getOnShiftRefereeIds(match.organizationId);
}

export async function dmRefereeRequest(client, match, requester, targetIds) {
  let sent = 0;
  const uniqueIds = [...new Set(targetIds.filter(Boolean))];

  for (const id of uniqueIds) {
    const user = await client.users.fetch(id).catch(() => null);

    if (!user) {
      continue;
    }

    const ok = await user
      .send({
        content: [
          `Referee requested for match \`${match.id}\`: ${match.teamA} vs ${match.teamB}`,
          requester ? `Requested by: ${requester.tag ?? requester.username} (${requester.id})` : null,
          match.room?.textChannelId ? `Room: <#${match.room.textChannelId}>` : null,
          `Status: ${match.status}`,
          `Score: ${match.score.teamA}-${match.score.teamB}`,
        ]
          .filter(Boolean)
          .join('\n'),
        allowedMentions: { parse: [] },
      })
      .then(() => true)
      .catch(() => false);

    if (ok) {
      sent += 1;
    }
  }

  return sent;
}
