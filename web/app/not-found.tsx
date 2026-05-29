import Link from "next/link";
import { ArrowRight, SearchX } from "lucide-react";

import { PublicFooter, PublicHeader } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { siteName } from "@/lib/site";

export default function NotFound() {
  return (
    <main className="bg-background text-foreground">
      <PublicHeader />
      <section className="mx-auto flex min-h-[62vh] max-w-3xl flex-col items-start justify-center px-5 py-16 sm:px-8">
        <div className="mb-5 flex size-12 items-center justify-center rounded-lg border bg-muted/35">
          <SearchX className="size-6 text-cyan-500" />
        </div>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Page not found
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          This Arbiter page is missing.
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground leading-7">
          The link may be outdated, private, or tied to a dashboard workspace
          you cannot access. The rest of {siteName} is still available.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/">
              Go home
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login?callbackURL=%2Fdashboard">Open dashboard</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a
              href="https://github.com/devabdullahs/Arbiter/issues"
              target="_blank"
              rel="noreferrer"
            >
              Report a broken link
            </a>
          </Button>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
