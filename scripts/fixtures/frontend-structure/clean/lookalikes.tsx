import { useFiles } from "@/lib/queries";

declare const queryClient: { fetchQuery: (o: unknown) => unknown; prefetchQuery: (o: unknown) => unknown };
declare const api: { fetch: (x: string) => unknown };

export function Files({ refetch }: { refetch: () => void }) {
  const { data } = useFiles();
  queryClient.fetchQuery({});
  queryClient.prefetchQuery({});
  api.fetch("own method named fetch is not the global");
  refetch();
  return <div>{String(data)}</div>;
}
