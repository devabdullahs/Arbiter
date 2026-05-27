import { prisma } from '../db/prisma.js';
import { toMatchView } from '../utils/match-view.js';
import { updateMatchMessages } from '../utils/match-message-updater.js';

const MATCH_INCLUDE = {
  organization: { include: { settings: true } },
  vetoActions: { orderBy: { createdAt: 'asc' } },
  room: true,
  rosterSubmissions: true,
  warnings: { orderBy: { createdAt: 'asc' } },
  pauseLogs: { orderBy: { createdAt: 'asc' } },
  evidence: { orderBy: { createdAt: 'asc' } },
};

let running = false;

export function startDiscordSyncLoop(client) {
  const intervalMs = Number(process.env.DISCORD_SYNC_INTERVAL_MS ?? 5000);
  setInterval(() => runDiscordSyncOnce(client).catch((error) => console.error(error)), intervalMs).unref?.();
}

export async function runDiscordSyncOnce(client) {
  if (running) return;
  running = true;

  try {
    const jobs = await prisma.discordSyncJob.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    for (const job of jobs) {
      await processJob(client, job);
    }
  } finally {
    running = false;
  }
}

async function processJob(client, job) {
  await prisma.discordSyncJob.update({
    where: { id: job.id },
    data: {
      status: 'processing',
      attempts: { increment: 1 },
      claimedAt: new Date(),
    },
  });

  try {
    if (job.targetType === 'match' && job.action === 'refresh') {
      const match = await prisma.match.findUnique({
        where: { id: job.targetId },
        include: MATCH_INCLUDE,
      });

      if (match) {
        await updateMatchMessages(client, toMatchView(match));
      }
    }

    await prisma.discordSyncJob.update({
      where: { id: job.id },
      data: { status: 'complete', completedAt: new Date(), lastError: null },
    });
  } catch (error) {
    await prisma.discordSyncJob.update({
      where: { id: job.id },
      data: {
        status: job.attempts >= 4 ? 'failed' : 'pending',
        lastError: error.message?.slice(0, 1000) ?? 'Discord sync failed',
      },
    });
  }
}
