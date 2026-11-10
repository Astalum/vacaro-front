import { isTimeValue } from "~/lib/time";

export const CALENDAR_AVAILABILITY_WINDOW_STORAGE_KEY =
	"vacaro.calendar-availability-window";

export interface CalendarAvailabilityWindow {
	start: string;
	end: string;
}

export const DEFAULT_CALENDAR_AVAILABILITY_WINDOW: CalendarAvailabilityWindow =
	{
		start: "09:00",
		end: "18:00",
	};

export function savedCalendarAvailabilityWindow(): CalendarAvailabilityWindow {
	try {
		const value = window.localStorage.getItem(
			CALENDAR_AVAILABILITY_WINDOW_STORAGE_KEY,
		);
		const saved = value ? (JSON.parse(value) as unknown) : null;
		if (
			saved &&
			typeof saved === "object" &&
			"start" in saved &&
			"end" in saved &&
			isTimeValue(saved.start) &&
			isTimeValue(saved.end) &&
			saved.start < saved.end
		) {
			return { start: saved.start, end: saved.end };
		}
	} catch {
		// Storage may be unavailable in privacy-focused browser modes.
	}
	return { ...DEFAULT_CALENDAR_AVAILABILITY_WINDOW };
}

export function saveCalendarAvailabilityWindow(
	range: CalendarAvailabilityWindow,
) {
	if (
		!isTimeValue(range.start) ||
		!isTimeValue(range.end) ||
		range.start >= range.end
	) {
		return false;
	}
	try {
		window.localStorage.setItem(
			CALENDAR_AVAILABILITY_WINDOW_STORAGE_KEY,
			JSON.stringify(range),
		);
		return true;
	} catch {
		return false;
	}
}
