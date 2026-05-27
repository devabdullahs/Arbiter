import type { Metadata } from "next";
import Link from "next/link";

import { siteName, siteUrl } from "@/lib/site";

const updatedAt = "May 27, 2026";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for Arbiter, a self-hosted Discord esports referee and tournament operations bot.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <p className="text-muted-foreground text-sm">Last updated: {updatedAt}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        {siteName} Terms of Service
      </h1>
      <div className="text-muted-foreground mt-6 space-y-5 leading-7">
        <p>
          These terms govern use of {siteName}, an open-source Discord esports
          referee and tournament operations bot and dashboard. By using the bot,
          dashboard, or a self-hosted deployment, you agree to use it lawfully
          and responsibly.
        </p>

        <section className="space-y-2">
          <h2 className="text-foreground text-xl font-semibold">Service Use</h2>
          <p>
            {siteName} helps tournament staff manage matches, battle-royale
            lobbies, check-ins, scores, warnings, evidence, audit logs, and
            related esports operations. You are responsible for the tournaments,
            rulings, server permissions, and data you manage with the service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-xl font-semibold">
            Discord Servers And Permissions
          </h2>
          <p>
            If you install {siteName} into a Discord server, you are responsible
            for ensuring you have permission to do so. Server administrators
            control Discord permissions, channels, roles, and bot access inside
            their own guilds.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-xl font-semibold">
            Acceptable Use
          </h2>
          <p>
            Do not use {siteName} to harass others, collect data without proper
            authority, upload unlawful content, interfere with Discord, bypass
            platform restrictions, or operate events in a way that violates
            applicable rules, laws, or Discord policies.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-xl font-semibold">
            Self-Hosted Deployments
          </h2>
          <p>
            {siteName} is open source and may be self-hosted. If you operate
            your own deployment, you are responsible for its security, backups,
            environment variables, database, uptime, data retention, and legal
            obligations.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-xl font-semibold">
            No Warranty
          </h2>
          <p>
            {siteName} is provided as-is, without warranties of availability,
            fitness for a particular purpose, tournament correctness, or
            uninterrupted operation. Always verify critical rulings and scores.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-xl font-semibold">
            Changes
          </h2>
          <p>
            These terms may be updated as the project evolves. Continued use
            after an update means you accept the revised terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-xl font-semibold">Contact</h2>
          <p>
            For questions, open an issue on the project repository or contact
            the project maintainer through the links on{" "}
            <Link href="/about" className="text-primary hover:underline">
              {siteUrl}/about
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
