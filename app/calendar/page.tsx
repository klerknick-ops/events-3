import { Suspense } from "react";
import { MonthCalendar } from "@/components/MonthCalendar";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  return (
    <Suspense>
      <MonthCalendar />
    </Suspense>
  );
}
