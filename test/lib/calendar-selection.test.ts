import { afterEach, describe, expect, it, vi } from "vitest";
import {
	CALENDAR_SELECTION_STORAGE_KEY,
	type GoogleCalendar,
	savedCalendarIDs,
} from "~/lib/api";

const calendars: GoogleCalendar[] = [
	{ id: "holiday", summary: "祝日", primary: false, selected: true },
	{ id: "main", summary: "メイン", primary: true, selected: true },
	{ id: "work", summary: "共有", primary: false, selected: true },
];

describe("calendar import selection", () => {
	afterEach(() => {
		window.localStorage.clear();
		vi.restoreAllMocks();
	});
	it("defaults to the primary calendar even when holidays are visible in Google Calendar", () => {
		expect(savedCalendarIDs(calendars)).toEqual(["main"]);
	});
	it("keeps calendars the user explicitly saved", () => {
		window.localStorage.setItem(
			CALENDAR_SELECTION_STORAGE_KEY,
			JSON.stringify(["main", "work"]),
		);
		expect(savedCalendarIDs(calendars)).toEqual(["main", "work"]);
	});
	it("falls back to the primary calendar when stored calendars are no longer accessible", () => {
		window.localStorage.setItem(
			CALENDAR_SELECTION_STORAGE_KEY,
			JSON.stringify(["removed"]),
		);
		expect(savedCalendarIDs(calendars)).toEqual(["main"]);
	});
	it("uses the primary calendar when storage is unavailable", () => {
		vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
			throw new Error("unavailable");
		});
		expect(savedCalendarIDs(calendars)).toEqual(["main"]);
	});
	it("handles an empty calendar list", () => {
		expect(savedCalendarIDs([])).toEqual([]);
	});
});
