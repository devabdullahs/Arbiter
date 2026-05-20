export async function sendRefereeReceipt(user, payload) {
  return safeDm(user, [
    `Reference logged for match \`${payload.match.id}\`: ${payload.match.teamA} vs ${payload.match.teamB}`,
    payload.title ? `**${payload.title}**` : null,
    payload.body,
    payload.attachments?.length ? `Attachments: ${payload.attachments.map((item) => item.url).join(' ')}` : null,
  ]);
}

export async function sendPlayerNotice(user, payload) {
  return safeDm(user, [
    `Match update for \`${payload.match.id}\`: ${payload.match.teamA} vs ${payload.match.teamB}`,
    payload.title ? `**${payload.title}**` : null,
    payload.body,
  ]);
}

async function safeDm(user, lines) {
  if (!user) {
    return false;
  }

  const content = lines.filter(Boolean).join('\n');
  await user.send({ content, allowedMentions: { parse: [] } }).catch(() => null);
  return true;
}
