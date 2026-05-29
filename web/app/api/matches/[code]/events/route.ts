import { NextResponse } from "next/server";

import { getAccessContext } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MatchState = {
  version: string;
  status: string;
  latestVeto: string;
  latestCharacterBan: string;
  latestScore: string;
  latestEvidence: string;
  latestMap: string;
  latestCheckin: string;
  latestReferee: string;
};

function encodeSse(state: MatchState, alert?: string | null) {
  return `event: match\ndata: ${JSON.stringify({ version: state.version, alert })}\n\n`;
}

function describeChange(previous: MatchState, next: MatchState) {
  if (previous.status !== next.status) {
    if (next.status === "VETO") return "Veto started or resumed.";
    if (next.status === "LIVE") return "Match started or score updated.";
    if (next.status === "DISPUTED") return "Match was marked disputed.";
    if (next.status === "COMPLETE") return "Match completed.";
    if (next.status === "CANCELLED") return "Match cancelled.";
    return "Match status changed.";
  }
  if (previous.latestVeto !== next.latestVeto) return "Veto turn updated.";
  if (previous.latestCharacterBan !== next.latestCharacterBan) {
    return "Character ban phase updated.";
  }
  if (previous.latestMap !== next.latestMap) return "Map score updated.";
  if (previous.latestScore !== next.latestScore) return "Score report updated.";
  if (previous.latestCheckin !== next.latestCheckin) return "Player check-in received.";
  if (previous.latestEvidence !== next.latestEvidence) return "Evidence was submitted.";
  if (previous.latestReferee !== next.latestReferee) return "Referee assignment updated.";
  return "Match updated.";
}

async function getMatchState(code: string, orgIds: string[], profileId?: string) {
  const accessFilters = [
    ...(orgIds.length ? [{ organizationId: { in: orgIds } }] : []),
    ...(profileId
      ? [
          {
            participants: {
              some: {
                team: {
                  OR: [
                    { captainProfileId: profileId },
                    { members: { some: { userProfileId: profileId } } },
                  ],
                },
              },
            },
          },
        ]
      : []),
  ];

  if (accessFilters.length === 0) return null;

  const match = await prisma.match.findFirst({
    where: {
      publicCode: code.toUpperCase(),
      OR: accessFilters,
    },
    select: {
      status: true,
      updatedAt: true,
      vetoActions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      characterBanActions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      scoreReports: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      evidence: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      mapResults: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { updatedAt: true },
      },
      checkins: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      refereeAssignments: {
        where: { status: "active" },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { updatedAt: true },
      },
    },
  });

  if (!match) return null;

  const state = {
    status: match.status,
    latestVeto: match.vetoActions[0]?.createdAt.toISOString() ?? "no-veto",
    latestCharacterBan:
      match.characterBanActions[0]?.createdAt.toISOString() ?? "no-character-ban",
    latestScore: match.scoreReports[0]?.createdAt.toISOString() ?? "no-score",
    latestEvidence: match.evidence[0]?.createdAt.toISOString() ?? "no-evidence",
    latestMap: match.mapResults[0]?.updatedAt.toISOString() ?? "no-maps",
    latestCheckin: match.checkins[0]?.createdAt.toISOString() ?? "no-checkins",
    latestReferee:
      match.refereeAssignments[0]?.updatedAt.toISOString() ?? "no-refs",
  };

  return {
    ...state,
    version: [
      state.status,
      match.updatedAt.toISOString(),
      state.latestVeto,
      state.latestCharacterBan,
      state.latestScore,
      state.latestEvidence,
      state.latestMap,
      state.latestCheckin,
      state.latestReferee,
    ].join(":"),
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const ctx = await getAccessContext();
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });

  const viewerProfile = ctx.discordId
    ? await prisma.userProfile.findUnique({
        where: { discordUserId: ctx.discordId },
        select: { id: true },
      })
    : null;

  const firstState = await getMatchState(code, ctx.orgIds, viewerProfile?.id);
  if (!firstState) return new NextResponse("Not found", { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastState = firstState;
      controller.enqueue(encoder.encode(encodeSse(lastState)));

      while (!request.signal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (request.signal.aborted) break;

        const nextState = await getMatchState(code, ctx.orgIds, viewerProfile?.id);

        if (!nextState) {
          controller.enqueue(encoder.encode("event: close\ndata: gone\n\n"));
          break;
        }

        if (nextState.version !== lastState.version) {
          const alert = describeChange(lastState, nextState);
          lastState = nextState;
          controller.enqueue(encoder.encode(encodeSse(nextState, alert)));
        } else {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }
      }

      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
