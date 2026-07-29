import type { Metadata } from "next";
import "./globals.css";

import { ThemeProvider } from "@/components/layout/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { HealthBanner } from "@/components/layout/health-banner";
import { Toaster } from "@/components/ui/sonner";
import { QueryClientProvider } from "@/lib/query-client";
import { RefreshProvider } from "@/lib/refresh-context";
import { UploadQueueProvider } from "@/lib/upload-queue-context";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/app-config";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <QueryClientProvider>
            <RefreshProvider>
              {/* Above the layout chrome on purpose: the upload queue has to
                  outlive the page that started it, and the header reads it to
                  show an app-wide in-progress indicator. */}
              <UploadQueueProvider>
                <SidebarProvider>
                  <TooltipProvider>
                    <AppSidebar />
                    <div className="flex flex-1 flex-col">
                      <Header />
                      <HealthBanner />
                      <main className="flex-1 overflow-auto p-6 lg:p-8">
                        {children}
                      </main>
                    </div>
                    <Toaster />
                  </TooltipProvider>
                </SidebarProvider>
              </UploadQueueProvider>
            </RefreshProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
