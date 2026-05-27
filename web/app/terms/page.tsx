import type { Metadata } from "next";
import Link from "next/link";

import { PublicFooter, PublicHeader } from "@/components/public-shell";
import { siteName, siteUrl } from "@/lib/site";

const updatedAt = "May 27, 2026";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for the hosted Arbiter Discord esports referee and tournament operations service.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <main className="bg-background text-foreground">
      <PublicHeader />
      <article className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          Back to home
        </Link>
        <p className="text-muted-foreground mt-4 text-sm">
          Last updated: {updatedAt}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {siteName} Terms of Service
        </h1>
        <div className="text-muted-foreground mt-6 space-y-5 leading-7">
        <p>
          These terms govern use of the hosted {siteName} Discord esports
          referee and tournament operations service. The {siteName} codebase is
          also open source; if you choose to self-host it, you operate your own
          separate deployment and are responsible for that deployment.
        </p>

        <section className="space-y-2">
          <h2 className="text-foreground text-xl font-semibold">Service Use</h2>
          <p>
            The hosted {siteName} service helps tournament staff manage
            matches, battle-royale lobbies, check-ins, scores, warnings,
            evidence, audit logs, and related esports operations. You are
            responsible for the tournaments, rulings, server permissions, and
            data you manage with the service.
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
            The open-source project may be self-hosted. A self-hosted
            deployment is operated by its own administrator, not by the hosted
            {siteName} service. If you operate your own deployment, you are
            responsible for its security, backups, environment variables,
            database, uptime, data retention, and legal obligations.
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
      </article>
      <PublicFooter />
    </main>
  );
}
