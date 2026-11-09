import { lazy, Suspense } from "react";
import type { ComponentProps } from "react";
import type { Calendar as CalendarComponent } from "./calendar";

const Calendar = lazy(async () => ({
	default: (await import("./calendar")).Calendar,
}));

// Keep the calendar and its date library out of forms until a picker opens.
export function CalendarPanel(props: ComponentProps<typeof CalendarComponent>) {
	return (
		<Suspense
			fallback={
				<div className="picker-calendar-loading" role="status">
					カレンダーを読み込んでいます…
				</div>
			}
		>
			<Calendar {...props} />
		</Suspense>
	);
}
