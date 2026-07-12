import { Card, Skeleton } from "@/components/data-display/primitives";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading page" className="space-y-7 py-2">
      <div className="space-y-3">
        <Skeleton className="h-9 w-52 max-w-full" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <div className="metric-grid">
        {[0, 1, 2, 3].map((item) => (
          <Card key={item} className="space-y-4 p-6">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-36 max-w-full" />
            <Skeleton className="h-4 w-24" />
          </Card>
        ))}
      </div>
      <Card className="space-y-4 p-6">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </Card>
    </div>
  );
}
