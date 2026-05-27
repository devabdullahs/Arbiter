import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Database,
  GitBranch,
  MessageSquareWarning,
  ShieldCheck,
  Table2,
  Trophy,
  Users,
} from "lucide-react";

import { PublicFooter, PublicHeader } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { siteDescription, siteKeywords, siteName } from "@/lib/site";

export const metadata: Metadata = {
  title: "Discord esports referee bot",
  description: siteDescription,
  keywords: siteKeywords,
  alternates: {
    canonical: "/",
  },
};

const features = [
  {
    title: "Match panels",
    body: "Create Discord match rooms, run vetoes, log scores, handle pauses, warnings, evidence, disputes, forfeits, and DQs.",
    icon: ClipboardCheck,
  },
  {
    title: "Battle royale lobbies",
    body: "Run Apex, Fortnite, PUBG, and other BR lobbies with standings, penalties, referee logs, and team-room workflows.",
    icon: Trophy,
  },
  {
    title: "Player check-ins",
    body: "Link registered teams to matches so players can check in, confirm game accounts, and see their assigned matches.",
    icon: Users,
  },
  {
    title: "Evidence vault",
    body: "Keep screenshots, notes, rulings, and audit history searchable instead of scattered across chats and sheets.",
    icon: Database,
  },
  {
    title: "Hosted or self-hosted",
    body: "Use the hosted version for convenience, or run Postgres, Prisma, Discord.js, and Docker on your own infrastructure.",
    icon: ShieldCheck,
  },
  {
    title: "Open-source workflow",
    body: "Built for organizers who need Discord-native operations without trusting a closed outside service.",
    icon: GitBranch,
  },
];

const replacedItems = [
  {
    before: "Google Sheets",
    after: "Live match, BR, warning, and penalty records",
    icon: Table2,
  },
  {
    before: "Unstructured pings",
    after: "Referee calls routed from match and team rooms",
    icon: MessageSquareWarning,
  },
  {
    before: "Lost screenshots",
    after: "Evidence vault tied to matches, teams, and rulings",
    icon: Database,
  },
  {
    before: "Manual audit trails",
    after: "Searchable logs for scores, pauses, disputes, and closes",
    icon: ClipboardCheck,
  },
];

export default function LandingPage() {
  return (
    <main className="bg-background text-foreground">
      <PublicHeader />

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:py-24">
        <div>
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
            Discord esports operations
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            {siteName} is the referee desk for Discord tournaments.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            {siteDescription}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/login?callbackURL=%2Fdashboard">
                Open dashboard
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a
                href="https://github.com/devabdullahs/Arbiter"
                target="_blank"
                rel="noreferrer"
              >
                View source
              </a>
            </Button>
          </div>
        </div>
        <div className="rounded-lg border bg-muted/25 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b pb-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Replaces
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                One desk instead of five tabs.
              </h2>
            </div>
            <span className="rounded-full border px-3 py-1 text-xs font-medium text-cyan-600 dark:text-cyan-300">
              Discord native
            </span>
          </div>

          <div className="divide-y">
            {replacedItems.map((item) => (
              <div
                key={item.before}
                className="grid gap-3 py-4 sm:grid-cols-[minmax(0,0.9fr)_2rem_minmax(0,1.25fr)] sm:items-center"
              >
                <div className="flex min-h-12 items-center gap-3 text-muted-foreground">
                  <item.icon className="size-4 shrink-0" />
                  <span className="text-sm">{item.before}</span>
                </div>
                <div className="hidden min-h-12 items-center justify-center sm:flex">
                  <ArrowRight className="size-4 text-muted-foreground" />
                </div>
                <div className="flex min-h-12 items-center gap-3">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                  <span className="text-sm font-medium leading-5">
                    {item.after}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-3 gap-3 border-t pt-4 text-center">
            <div>
              <p className="text-lg font-semibold">24/7</p>
              <p className="text-xs text-muted-foreground">event logs</p>
            </div>
            <div>
              <p className="text-lg font-semibold">BR</p>
              <p className="text-xs text-muted-foreground">standings</p>
            </div>
            <div>
              <p className="text-lg font-semibold">Audit</p>
              <p className="text-xs text-muted-foreground">ready</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight">
            Built for structured tournament operations.
          </h2>
          <p className="text-muted-foreground mt-3 leading-7">
            Referees and admins can work from Discord or the web dashboard.
            Match changes, evidence, check-ins, and audit records stay tied to
            the organization, match, team, and player records behind them.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-lg border p-5">
              <feature.icon className="mb-4 size-5 text-cyan-500" />
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
