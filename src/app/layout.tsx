import type { Metadata } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
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

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InsightFlow",
  description: "Turn customer feedback into prioritized decisions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the theme script adds the "dark" class before React starts.
    <html lang="en" suppressHydrationWarning className={`${figtree.variable} ${geistMono.variable} h-full antialiased`}>
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
