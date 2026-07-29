import type { FileMetadata } from "@vibe-coding-starter-kit/shared";

export interface TreeFolder {
  type: "folder";
  name: string;
  path: string;
  children: TreeNode[];
}

export interface TreeFile {
  type: "file";
  name: string;
  data: FileMetadata;
}

export type TreeNode = TreeFolder | TreeFile;

/**
 * Build a tree structure from a flat list of S3 keys.
 * e.g. ["uploads/a.jpg", "uploads/photos/b.png", "docs/c.pdf"]
 * becomes a nested folder/file hierarchy.
 */
export function buildFileTree(files: FileMetadata[]): TreeNode[] {
  const root: TreeFolder = {
    type: "folder",
    name: "",
    path: "",
    children: [],
  };

  for (const file of files) {
    const parts = file.key.split("/");
    let current = root;

    // Walk/create folders for all parts except the last (filename)
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      const folderPath = parts.slice(0, i + 1).join("/") + "/";
      let folder = current.children.find(
        (c): c is TreeFolder => c.type === "folder" && c.name === folderName
      );
      if (!folder) {
        folder = {
          type: "folder",
          name: folderName,
          path: folderPath,
          children: [],
        };
        current.children.push(folder);
      }
      current = folder;
    }

    // Add the file as a leaf
    current.children.push({
      type: "file",
      name: file.filename,
      data: file,
    });
  }

  // Sort: folders first (alphabetical), then files (most recent first)
  sortTree(root.children);

  return root.children;
}

/** Hard stop for auto-expansion, so a pathological key depth can't loop. */
export const MAX_AUTO_EXPAND_DEPTH = 8;

function foldersOf(nodes: TreeNode[]): TreeFolder[] {
  return nodes.filter((n): n is TreeFolder => n.type === "folder");
}

/** Total files anywhere in the tree, at any depth. */
function countFiles(nodes: TreeNode[]): number {
  let total = 0;
  for (const node of nodes) {
    if (node.type === "file") total += 1;
    else total += countFiles(node.children);
  }
  return total;
}

/**
 * Which folders to expand when the list first arrives, so file rows are
 * actually on screen.
 *
 * Expanding only the top level left `/files` showing four folder rows and zero
 * files while the page said "Click a file to preview it" — the newest objects
 * lived two levels deep, so the page looked empty and its own instruction was
 * unactionable.
 *
 * Stopping at the *first* visible file wasn't enough either: one stray
 * top-level object satisfied the check while the other 99 stayed hidden inside
 * collapsed folders, so the page still claimed "Showing the 100 most recent"
 * with a single row on screen. The bar is therefore a MAJORITY of the listed
 * files being reachable without clicking, not merely one of them.
 */
export function initialExpandedPaths(
  nodes: TreeNode[],
  maxDepth: number = MAX_AUTO_EXPAND_DEPTH,
): Set<string> {
  const expanded = new Set<string>();
  const totalFiles = countFiles(nodes);
  let visibleFiles = nodes.filter((n) => n.type === "file").length;
  let frontier = foldersOf(nodes);

  // Nothing to reveal, or most of it is already on screen.
  const enoughVisible = () => totalFiles === 0 || visibleFiles * 2 >= totalFiles;

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    // The top level always opens (the documented behaviour); deeper levels open
    // only while the majority of files are still out of reach.
    for (const folder of frontier) expanded.add(folder.path);

    const revealed = frontier.flatMap((folder) => folder.children);
    visibleFiles += revealed.filter((child) => child.type === "file").length;
    if (enoughVisible()) break;

    frontier = foldersOf(revealed);
  }

  return expanded;
}

function sortTree(nodes: TreeNode[]) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    if (a.type === "folder" && b.type === "folder") {
      return a.name.localeCompare(b.name);
    }
    // Files: most recent first
    if (a.type === "file" && b.type === "file") {
      return (
        new Date(b.data.uploaded_at).getTime() -
        new Date(a.data.uploaded_at).getTime()
      );
    }
    return 0;
  });

  for (const node of nodes) {
    if (node.type === "folder") {
      sortTree(node.children);
    }
  }
}
