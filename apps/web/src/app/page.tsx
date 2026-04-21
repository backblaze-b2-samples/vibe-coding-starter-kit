import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentUploadsTable } from "@/components/dashboard/recent-uploads-table";
import { UploadChart } from "@/components/dashboard/upload-chart";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="relative animate-fade-in border-b border-border pb-5 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-[28rem] rounded-full blur-3xl opacity-60"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgba(9,105,218,0.14), rgba(26,127,55,0.08) 50%, transparent 75%)",
          }}
        />
        <div className="relative">
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Overview of your Backblaze B2 storage activity.
          </p>
        </div>
      </div>
      <StatsCards />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="animate-fade-in-up stagger-3">
          <UploadChart />
        </div>
        <div className="animate-fade-in-up stagger-4">
          <RecentUploadsTable />
        </div>
      </div>
    </div>
  );
}
