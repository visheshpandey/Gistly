import type { Metadata } from "next";
import { Figtree, Fraunces, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { DataProvider } from "@/components/data-provider";
import { AdaptionProvider } from "@/components/adaption-provider";
import { ToastProvider } from "@/components/toast";
import { UploadProvider } from "@/components/upload-provider";
import { AnalysisProvider } from "@/components/use-analysis";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

// Headings, big numbers and the wordmark. A variable font, so the soft and "wonky" shapes can be switched on.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "AI-powered feedback intelligence: import customer feedback, see sentiment and themes, and get a ranked list of what to fix first.";

export const metadata: Metadata = {
  title: { default: "InsightFlow", template: "%s · InsightFlow" },
  description: DESCRIPTION,
  applicationName: "InsightFlow",
  openGraph: { title: "InsightFlow", description: DESCRIPTION, siteName: "InsightFlow", type: "website" },
  twitter: { card: "summary_large_image", title: "InsightFlow", description: DESCRIPTION },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the theme script adds the "dark" class before React starts.
    <html lang="en" suppressHydrationWarning className={`${figtree.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <DataProvider>
          <ToastProvider>
            <AnalysisProvider>
              <AdaptionProvider>
                <UploadProvider>
                  <AppShell>{children}</AppShell>
                </UploadProvider>
              </AdaptionProvider>
            </AnalysisProvider>
          </ToastProvider>
        </DataProvider>
      </body>
    </html>
  );
}
