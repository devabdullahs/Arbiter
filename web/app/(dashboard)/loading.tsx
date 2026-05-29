import { Skeleton } from "@/components/ui/skeleton";

function MetricSkeleton() {
  return (
    <div className="rounded-lg border p-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-8 w-16" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <div className="grid grid-cols-[1.5fr_1fr_1fr_6rem] items-center gap-3 border-t px-4 py-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading dashboard content">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </div>

      <div className="rounded-lg border">
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="border-t bg-muted/30 px-4 py-3">
          <div className="grid grid-cols-[1.5fr_1fr_1fr_6rem] gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
        <TableRowSkeleton />
        <TableRowSkeleton />
        <TableRowSkeleton />
        <TableRowSkeleton />
      </div>
    </div>
  );
}
