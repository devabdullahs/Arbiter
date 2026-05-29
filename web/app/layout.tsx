import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Analytics } from "@/components/analytics";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { siteDescription, siteKeywords, siteName, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: "Arbiter - Discord esports referee bot",
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: siteKeywords,
  authors: [{ name: "Abdullah", url: "https://github.com/devabdullahs" }],
  creator: "Abdullah",
  publisher: siteName,
  category: "Esports operations software",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "256x256" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/arbiter-icon-256.png", sizes: "256x256", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName,
    title: "Arbiter - Discord esports referee bot",
    description: siteDescription,
    images: [
      {
        url: "/og-image.png",
        width: 1774,
        height: 887,
        alt: "Arbiter esports referee bot dashboard banner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Arbiter - Discord esports referee bot",
    description: siteDescription,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The CSP nonce set by proxy.ts. Reading it opts the tree into dynamic
  // rendering, which a nonce-based CSP requires (static HTML can't be nonced).
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full">
        <ThemeProvider defaultTheme="system">
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
          <Analytics nonce={nonce} />
        </ThemeProvider>
      </body>
    </html>
  );
}
