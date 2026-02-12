"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/upload": "Upload",
  "/files": "Files",
};

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const pageTitle = pageTitles[pathname] || "Page";

  return (
    <header className="flex h-12 items-center gap-2 bg-nav text-nav-foreground px-4">
      <SidebarTrigger className="text-nav-foreground/70 hover:text-nav-foreground hover:bg-nav-foreground/10" />
      <Separator orientation="vertical" className="mx-1 h-4 bg-nav-foreground/20" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/" className="text-nav-foreground/70 hover:text-nav-foreground">
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
          {pathname !== "/" && (
            <>
              <BreadcrumbSeparator className="text-nav-foreground/40" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-nav-foreground">
                  {pageTitle}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-nav-foreground/70 hover:text-nav-foreground hover:bg-nav-foreground/10">
          <Bell className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-nav-foreground/70 hover:text-nav-foreground hover:bg-nav-foreground/10"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>
    </header>
  );
}
