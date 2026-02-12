import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentUploadsTable } from "@/components/dashboard/recent-uploads-table";
import { UploadChart } from "@/components/dashboard/upload-chart";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <StatsCards />
      <div className="grid gap-6 lg:grid-cols-2">
        <UploadChart />
        <RecentUploadsTable />
      </div>
    </div>
  );
}
