import { prisma } from '../db/prisma.js';

const timers = new WeakSet();

export async function createPauseReminder(match, input) {
  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes <= 0 || !input.channelId) {
    return null;
  }

  const dueAt = new Date(Date.now() + Math.min(input.durationMinutes, 360) * 60_000);

  return prisma.scheduledReminder.create({
    data: {
      organizationId: match.organizationId,
      matchId: match.dbId,
      kind: 'pause_resume',
      dueAt,
      channelId: input.channelId,
      userId: input.byUserId ?? null,
      payload: {
        publicCode: match.id,
        teamA: match.teamA,
        teamB: match.teamB,
      },
    },
  });
}

export async function deliverDueReminders(client) {
  const due = await prisma.scheduledReminder.findMany({
    where: {
      deliveredAt: null,
      dueAt: { lte: new Date() },
    },
    take: 25,
    orderBy: { dueAt: 'asc' },
  });

  for (const reminder of due) {
    const payload = reminder.payload ?? {};
    const channel = reminder.channelId ? await client.channels.fetch(reminder.channelId).catch(() => null) : null;

    if (channel?.isTextBased()) {
      await channel
        .send({
          content: `Pause over for \`${payload.publicCode ?? 'match'}\` (${payload.teamA ?? 'Team A'} vs ${payload.teamB ?? 'Team B'}). ${
            reminder.userId ? `<@${reminder.userId}> ` : ''
          }resume the match.`,
          allowedMentions: { users: reminder.userId ? [reminder.userId] : [] },
        })
        .catch(() => null);
    }

    await prisma.scheduledReminder.update({
      where: { id: reminder.id },
      data: { deliveredAt: new Date() },
    });
  }
}

export function startReminderLoop(client) {
  if (timers.has(client)) {
    return;
  }

  timers.add(client);
  setInterval(() => {
    deliverDueReminders(client).catch((error) => console.error('Reminder delivery failed', error));
  }, 30_000);
  deliverDueReminders(client).catch((error) => console.error('Reminder delivery failed', error));
}
