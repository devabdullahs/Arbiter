import type { Metadata } from "next";
import Link from "next/link";

import { siteName, siteUrl } from "@/lib/site";

const updatedAt = "May 27, 2026";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for Arbiter, a self-hosted Discord esports referee and tournament operations bot.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <p className="text-muted-foreground text-sm">Last updated: {updatedAt}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        {siteName} Privacy Policy
      </h1>
      <div className="text-muted-foreground mt-6 space-y-5 leading-7">
        <p>
          This Privacy Policy explains how {siteName} handles data for its
          Discord bot and web dashboard. The project is designed to be
          self-hosted, so the organization operating a deployment controls the
          database and infrastructure for that deployment.
        </p>

        <section className="space-y-2">
          <h2 className="text-foreground text-xl font-semibold">
            Information Processed
          </h2>
          <p>
            Depending on how an organization uses {siteName}, the service may
            process Discord user IDs, Discord guild IDs, display names, linked
            game accounts, team names, match records, scores, check-ins, pause
            logs, warnings, evidence URLs or uploads, audit logs, profile
            settings, email addresses used for login, and OAuth account links.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-xl font-semibold">
            How Information Is Used
          </h2>
          <p>
            Data is used to operate esports events: resolving organization
            access, linking users to teams, recording referee actions, syncing
            Discord messages, reviewing evidence, and showing dashboard views
            to authorized users.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-xl font-semibold">
            Discord Data
          </h2>
          <p>
            {siteName} uses Discord IDs and OAuth account data to authenticate
            users, map them to organization memberships, and perform bot
            actions requested by authorized users. It does not need Discord
            message content except where users intentionally submit logs,
            evidence, or operational notes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-xl font-semibold">
            Evidence And Uploads
          </h2>
          <p>
            Evidence screenshots or URLs are stored so referees and admins can
            review disputes and rulings. Do not upload sensitive personal data
            unless it is necessary for tournament administration and you have
            authority to process it.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-xl font-semibold">
            Self-Hosted Deployments
          </h2>
          <p>
            If you self-host {siteName}, you decide where data is stored, how
            long it is retained, who can access it, and how backups and exports
            are handled. You are responsible for protecting your deployment and
            complying with applicable privacy requirements.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-xl font-semibold">
            Data Sharing
          </h2>
          <p>
            {siteName} does not sell personal data. Data may be shared with
            Discord as needed for bot and OAuth functionality, and with
            infrastructure providers chosen by the deployment operator.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-xl font-semibold">
            Requests And Removal
          </h2>
          <p>
            For hosted deployments, contact the deployment operator to request
            access, correction, or deletion. For the open-source project, open
            an issue or contact the maintainer through{" "}
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
