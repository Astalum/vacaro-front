import type { GoogleCalendar } from "./types";

export const CALENDAR_SELECTION_STORAGE_KEY = "vacaro.calendar-selection";

export function isGoogleHolidayCalendarID(calendarID: string) {
	return calendarID
		.trim()
		.toLowerCase()
		.endsWith("#holiday@group.v.calendar.google.com");
}

export function savedCalendarIDs(calendars: GoogleCalendar[]) {
	calendars = calendars.filter(
		(calendar) => !isGoogleHolidayCalendarID(calendar.id),
	);
	const availableIDs = new Set(calendars.map((calendar) => calendar.id));
	try {
		const value = window.localStorage.getItem(CALENDAR_SELECTION_STORAGE_KEY);
		const saved = value ? (JSON.parse(value) as unknown) : null;
		if (Array.isArray(saved)) {
			const valid = saved.filter(
				(id): id is string => typeof id === "string" && availableIDs.has(id),
			);
			if (valid.length > 0) return valid;
		}
	} catch {
		// Storage may be unavailable in privacy-focused browser modes.
	}
	// Google's selected flag means visible in Google Calendar, not suitable for
	// FreeBusy imports (for example, holiday calendars can return notFound).
	const primary = calendars.find((calendar) => calendar.primary);
	const fallback =
		calendars.find((calendar) => calendar.selected) ?? calendars[0];
	const initial = primary ?? fallback;
	return initial ? [initial.id] : [];
}

export function saveCalendarIDs(calendarIDs: string[]) {
	try {
		window.localStorage.setItem(
			CALENDAR_SELECTION_STORAGE_KEY,
			JSON.stringify(
				calendarIDs.filter((id) => !isGoogleHolidayCalendarID(id)),
			),
		);
		return true;
	} catch {
		return false;
	}
}

export function clearSavedCalendarIDs() {
	try {
		window.localStorage.removeItem(CALENDAR_SELECTION_STORAGE_KEY);
	} catch {
		// Nothing else is required when storage is unavailable.
	}
}
