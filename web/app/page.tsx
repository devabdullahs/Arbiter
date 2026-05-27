import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Database,
  GitBranch,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";

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
    title: "Self-hosted control",
    body: "Use Postgres, Prisma, Discord.js, and Docker so organizations can review the code and host their own instance.",
    icon: ShieldCheck,
  },
  {
    title: "Open-source workflow",
    body: "Built for organizers who need Discord-native operations without trusting a closed outside service.",
    icon: GitBranch,
  },
];

export default function LandingPage() {
  return (
    <main className="bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/arbiter-icon.png" alt="" className="size-8 rounded-md" />
            <span>{siteName}</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm text-muted-foreground">
            <Link href="/about" className="hidden hover:text-foreground sm:inline">
              About
            </Link>
            <a href="#features" className="hidden hover:text-foreground sm:inline">
              Features
            </a>
            <a
              href="https://github.com/devabdullahs/Arbiter"
              target="_blank"
              rel="noreferrer"
              className="hidden hover:text-foreground sm:inline"
            >
              Source
            </a>
            <Button asChild size="sm">
              <Link href="/login?callbackURL=%2Fdashboard">Sign in</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
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
        <div className="rounded-lg border bg-muted/30 p-5">
          <h2 className="text-lg font-semibold">What Arbiter replaces</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
            <li>Scattered Google Sheets for scores, penalties, and warnings.</li>
            <li>Unstructured Discord pings when players need a referee.</li>
            <li>Lost screenshots after match rooms and dispute threads close.</li>
            <li>Manual BR standings and tiebreak calculations.</li>
            <li>Unclear audit trails after rulings, forfeits, or disputes.</li>
          </ul>
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

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>{siteName} is open-source esports operations software.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
