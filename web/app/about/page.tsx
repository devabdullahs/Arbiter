import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, Database, ShieldCheck, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { siteDescription, siteKeywords, siteName } from "@/lib/site";

export const metadata: Metadata = {
  title: "Open-source Discord esports referee bot",
  description: siteDescription,
  keywords: siteKeywords,
  alternates: {
    canonical: "/about",
  },
};

const features = [
  {
    title: "Match operations",
    body: "Create match panels, run vetoes, record scores, log pauses, issue warnings, and keep a clean referee timeline.",
    icon: ClipboardCheck,
  },
  {
    title: "BR lobby control",
    body: "Score multi-team lobbies, apply penalties, track disputes, and keep standings synced between web and Discord.",
    icon: Trophy,
  },
  {
    title: "Evidence and audit trails",
    body: "Vault screenshots, notes, rulings, and admin actions so organizers can review decisions after the event.",
    icon: Database,
  },
  {
    title: "Self-hosted trust",
    body: "Run the bot and dashboard on your own infrastructure with Postgres and Prisma, with no outside operator required.",
    icon: ShieldCheck,
  },
];

export default function AboutPage() {
  return (
    <main className="bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="font-semibold">
            {siteName}
          </Link>
          <Button asChild size="sm">
            <Link href="/login?callbackURL=%2Fdashboard">Sign in</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          About Arbiter
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          {siteName} runs the referee desk inside Discord.
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
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-12 sm:px-8 md:grid-cols-2">
        {features.map((feature) => (
          <article key={feature.title} className="rounded-lg border p-5">
            <feature.icon className="mb-4 size-5 text-cyan-500" />
            <h2 className="text-lg font-semibold">{feature.title}</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              {feature.body}
            </p>
          </article>
        ))}
      </section>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link href="/" className="hover:text-foreground">
            Back to landing
          </Link>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
