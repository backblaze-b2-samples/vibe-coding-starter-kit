"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type { FileRejection } from "react-dropzone";
import { uploadFile } from "@/lib/api-client";
import { useRefresh } from "@/lib/refresh-context";
import { humanizeBytes } from "@/lib/utils";
import { interruptedUploadMessage, type UploadItem } from "@/lib/upload-status";

/**
 * App-wide upload queue.
 *
 * This state used to live inside `UploadForm`, so leaving `/upload` unmounted
 * it: an in-flight upload became invisible from every other page, returning to
 * `/upload` showed an empty queue with an enabled dropzone (so nothing stopped
 * a duplicate upload of a file already on the wire), and a reload dropped the
 * upload with no acknowledgement. Hoisting it to a provider mounted in the root
 * layout keeps one queue alive for the whole session.
 */

const MAX_TOAST_FILE_NAME_LENGTH = 80;
/** Names of uploads that were in flight, so a reload can own up to killing them. */
const IN_FLIGHT_STORAGE_KEY = "vibe-coding-starter-kit:uploads-in-flight";

function formatToastFileName(name: string) {
  if (name.length <= MAX_TOAST_FILE_NAME_LENGTH) return name;

  const sliceLength = Math.floor((MAX_TOAST_FILE_NAME_LENGTH - 3) / 2);
  return `${name.slice(0, sliceLength)}...${name.slice(-sliceLength)}`;
}

function createUploadItem(file: File): UploadItem {
  return {
    id: `${file.name}-${file.lastModified}-${Date.now()}-${Math.random()}`,
    file,
    progress: 0,
    retryable: true,
    status: "uploading",
  };
}

function createRejectedItem(file: File, error: string): UploadItem {
  return {
    id: `${file.name}-${file.lastModified}-${Date.now()}-${Math.random()}`,
    file,
    progress: 0,
    error,
    retryable: false,
    status: "error",
  };
}

function readInFlightNames(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(IN_FLIGHT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is string => typeof n === "string");
  } catch {
    return [];
  }
}

function writeInFlightNames(names: string[]) {
  if (typeof window === "undefined") return;
  try {
    if (names.length === 0) {
      window.sessionStorage.removeItem(IN_FLIGHT_STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(
        IN_FLIGHT_STORAGE_KEY,
        JSON.stringify(names),
      );
    }
  } catch {
    // Private-mode / quota failures must never break uploading.
  }
}

interface UploadQueueValue {
  items: UploadItem[];
  /** True while any row is still in flight. */
  uploading: boolean;
  addFiles: (files: File[]) => void;
  addRejections: (rejections: FileRejection[]) => void;
  retry: (id: string) => void;
  clearCompleted: () => void;
}

const UploadQueueContext = createContext<UploadQueueValue | null>(null);

export function UploadQueueProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const { triggerRefresh } = useRefresh();
  const restoredRef = useRef(false);

  const uploading = items.some((item) => item.status === "uploading");

  // Declared first so it runs before the sync effect below can clear the key.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const message = interruptedUploadMessage(readInFlightNames());
    writeInFlightNames([]);
    if (message) toast.warning(message);
  }, []);

  // Mirror what is genuinely in flight, so the *next* load can report the loss.
  useEffect(() => {
    if (!restoredRef.current) return;
    writeInFlightNames(
      items
        .filter((item) => item.status === "uploading")
        .map((item) => item.file.name),
    );
  }, [items]);

  // Ask before a reload/close throws away bytes already on the wire.
  useEffect(() => {
    if (!uploading) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uploading]);

  const runQueue = useCallback(
    async (queue: UploadItem[]) => {
      if (queue.length === 0) return;
      let anySuccess = false;

      try {
        for (const item of queue) {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    error: undefined,
                    progress: 0,
                    retryable: true,
                    status: "uploading",
                  }
                : i,
            ),
          );

          try {
            const response = await uploadFile(item.file, (percent) => {
              setItems((prev) =>
                prev.map((i) =>
                  i.id === item.id ? { ...i, progress: percent } : i,
                ),
              );
            });
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      status: "complete",
                      progress: 100,
                      metadata: response.metadata,
                    }
                  : i,
              ),
            );
            toast.success(
              `${formatToastFileName(item.file.name)} uploaded successfully`,
            );
            anySuccess = true;
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Upload failed";
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? { ...i, status: "error", error: message, retryable: true }
                  : i,
              ),
            );
            toast.error(
              `Failed to upload ${formatToastFileName(item.file.name)}: ${message}`,
            );
          }
        }
      } finally {
        if (anySuccess) triggerRefresh();
      }
    },
    [triggerRefresh],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      if (uploading) {
        toast.info("Wait for the current upload queue to finish first.");
        return;
      }
      const newItems = files.map(createUploadItem);
      setItems((prev) => [...prev, ...newItems]);
      void runQueue(newItems);
    },
    [runQueue, uploading],
  );

  const addRejections = useCallback((rejections: FileRejection[]) => {
    const rejected: UploadItem[] = [];

    for (const rejection of rejections) {
      const errors = rejection.errors.map((e) => {
        if (e.code === "file-too-large") {
          return `exceeds 100MB limit (${humanizeBytes(rejection.file.size)})`;
        }
        if (e.code === "file-invalid-type") return "file type not supported";
        return e.message;
      });
      const message = errors.join(", ") || "File could not be added.";
      rejected.push(createRejectedItem(rejection.file, message));
      toast.error(
        `${formatToastFileName(rejection.file.name)}: ${message}`,
      );
    }

    setItems((prev) => [...prev, ...rejected]);
  }, []);

  const retry = useCallback(
    (id: string) => {
      if (uploading) return;
      const item = items.find((i) => i.id === id);
      if (!item || item.retryable === false) return;
      void runQueue([item]);
    },
    [items, runQueue, uploading],
  );

  const clearCompleted = useCallback(() => {
    setItems((prev) => prev.filter((i) => i.status === "uploading"));
  }, []);

  const value = useMemo(
    () => ({
      items,
      uploading,
      addFiles,
      addRejections,
      retry,
      clearCompleted,
    }),
    [items, uploading, addFiles, addRejections, retry, clearCompleted],
  );

  return (
    <UploadQueueContext.Provider value={value}>
      {children}
    </UploadQueueContext.Provider>
  );
}

export function useUploadQueue(): UploadQueueValue {
  const value = useContext(UploadQueueContext);
  if (!value) {
    throw new Error("useUploadQueue must be used inside <UploadQueueProvider>");
  }
  return value;
}
