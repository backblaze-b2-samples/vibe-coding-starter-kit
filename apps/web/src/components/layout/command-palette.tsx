"use client";

import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  FolderOpen,
  Settings,
  Sparkles,
  FileIcon,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  FILE_LIST_LIMIT,
  fileListTruncationNotice,
} from "@/lib/file-list-limit";
import { previewHref } from "@/lib/preview-deep-link";
import { useFileStats, useFiles } from "@/lib/queries";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const routes = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Upload", href: "/upload", icon: Upload },
  { label: "Files", href: "/files", icon: FolderOpen },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Design System", href: "/design", icon: Sparkles },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { setTheme } = useTheme();

  // Same query (and therefore the same cache entry) the /files browser uses,
  // fetched only while the palette is open. It used to be a bare
  // `useEffect + getFiles()` that then rendered `files.slice(0, 20)`, so the
  // palette answered from a *different, smaller* set than the page behind it:
  // searching an exact filename that /files was displaying returned unrelated
  // neighbours and never said the search set was capped.
  const {
    data: files = [],
    isLoading: filesLoading,
  } = useFiles("", FILE_LIST_LIMIT, { enabled: open });
  const { data: stats } = useFileStats({ enabled: open });

  const boundNotice = fileListTruncationNotice(
    files.length,
    stats?.total_files,
    FILE_LIST_LIMIT,
  );

  const runThen = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search files or jump to a page..." />
      <CommandList>
        <CommandEmpty>
          {/* On a route that never fetched the list (e.g. /upload) the query
              starts cold when the palette opens, so a flat "No matches found."
              told the user their file didn't exist while it was visible on the
              page behind the dialog. Say we're still looking instead. */}
          {filesLoading ? (
            <span className="block">Loading files to search...</span>
          ) : (
            <>
              <span className="block">No matches found.</span>
              {/* Only claim a cap when there actually is one: with fewer objects
                  than the limit, the palette really did search everything. */}
              {boundNotice && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  File search covers the {files.length} most recent objects in
                  this bucket, not the whole bucket.
                </span>
              )}
            </>
          )}
        </CommandEmpty>
        <CommandGroup heading="Navigate">
          {routes.map((r) => (
            <CommandItem
              key={r.href}
              onSelect={runThen(() => router.push(r.href))}
              value={`nav ${r.label}`}
            >
              <r.icon />
              {r.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem onSelect={runThen(() => setTheme("light"))} value="theme light">
            <Sun />
            Light mode
          </CommandItem>
          <CommandItem onSelect={runThen(() => setTheme("dark"))} value="theme dark">
            <Moon />
            Dark mode
          </CommandItem>
          <CommandItem onSelect={runThen(() => setTheme("system"))} value="theme system">
            <Sparkles />
            System theme
          </CommandItem>
        </CommandGroup>
        {files.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Files">
              {files.map((f) => (
                <CommandItem
                  key={f.key}
                  value={`file ${f.filename} ${f.key}`}
                  // Land on the chosen file, not just on the Files page: this
                  // used to push "/files" and nothing else, so picking an exact
                  // filename left it inside a collapsed folder — and produced no
                  // visible change at all when already on /files.
                  onSelect={runThen(() => router.push(previewHref(f.key)))}
                >
                  <FileIcon />
                  <span className="truncate">{f.filename}</span>
                  <CommandShortcut>{f.size_human}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            {/* Same honesty the /files page carries: say what the search set is
                rather than silently answering from a slice of the bucket. */}
            {boundNotice && (
              <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                {boundNotice}
              </p>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
