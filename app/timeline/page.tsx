import { Suspense } from "react";
import { TimelineApp } from "@/components/timeline/TimelineApp";
import { WeekTimeline } from "@/components/timeline/WeekTimeline";

export const dynamic = "force-dynamic";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return (
    <Suspense>
      {view === "week" ? <WeekTimeline /> : <TimelineApp />}
    </Suspense>
  );
}
