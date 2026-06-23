import { Suspense } from "react";
import { TimelineApp } from "@/components/timeline/TimelineApp";

export const dynamic = "force-dynamic";

export default function TimelinePage() {
  return (
    <Suspense>
      <TimelineApp />
    </Suspense>
  );
}
