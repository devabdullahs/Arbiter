import Link from "next/link";

import { Button } from "@/components/ui/button";
import { siteName } from "@/lib/site";

export function PublicHeader() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3 font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/arbiter-icon-64.webp"
            alt="Arbiter logo"
            width={32}
            height={32}
            className="size-8 rounded-md"
          />
          <span>{siteName}</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm text-muted-foreground">
          <Link href="/about" className="hidden hover:text-foreground sm:inline">
            About
          </Link>
          <Link href="/#features" className="hidden hover:text-foreground sm:inline">
            Features
          </Link>
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
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>{siteName} is esports operations software with an open-source core.</p>
        <div className="flex flex-wrap gap-4">
          <Link href="/about" className="hover:text-foreground">
            About
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms of Service
          </Link>
          <Link href="/login?callbackURL=%2Fdashboard" className="hover:text-foreground">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
