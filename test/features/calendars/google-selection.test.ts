import { afterEach, describe, expect, it, vi } from "vitest";
import {
	CALENDAR_SELECTION_STORAGE_KEY,
	savedCalendarIDs,
	saveCalendarIDs,
	isGoogleHolidayCalendarID,
} from "~/features/calendars/google-selection";
import { type GoogleCalendar } from "~/features/calendars/types";

const holidayID = "ja.japanese.official#holiday@group.v.calendar.google.com";

const calendars: GoogleCalendar[] = [
	{ id: holidayID, summary: "祝日", primary: false, selected: true },
	{ id: "main", summary: "メイン", primary: true, selected: true },
	{ id: "work", summary: "共有", primary: false, selected: true },
];

describe("calendar import selection", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		window.localStorage.clear();
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
		vi.stubGlobal("window", {
			localStorage: {
				getItem: () => {
					throw new Error("unavailable");
				},
			},
		});
		expect(savedCalendarIDs(calendars)).toEqual(["main"]);
	});
	it("handles an empty calendar list", () => {
		expect(savedCalendarIDs([])).toEqual([]);
	});
	it("removes holidays from previously saved selections while keeping shared calendars", () => {
		window.localStorage.setItem(
			CALENDAR_SELECTION_STORAGE_KEY,
			JSON.stringify([holidayID, "main", "work"]),
		);
		expect(savedCalendarIDs(calendars)).toEqual(["main", "work"]);
	});
	it("falls back to the primary calendar when only holidays were saved", () => {
		window.localStorage.setItem(
			CALENDAR_SELECTION_STORAGE_KEY,
			JSON.stringify([holidayID]),
		);
		expect(savedCalendarIDs(calendars)).toEqual(["main"]);
	});
	it("does not persist holiday IDs", () => {
		expect(saveCalendarIDs([holidayID, "work"])).toBe(true);
		expect(
			JSON.parse(window.localStorage.getItem(CALENDAR_SELECTION_STORAGE_KEY)!),
		).toEqual(["work"]);
	});
	it("does not select a holiday when no importable calendar exists", () => {
		expect(savedCalendarIDs([calendars[0]])).toEqual([]);
	});
	it("keeps an ordinary calendar named for holiday work", () => {
		expect(
			savedCalendarIDs([
				{
					id: "work",
					summary: "祝日の出勤予定",
					primary: false,
					selected: true,
				},
			]),
		).toEqual(["work"]);
	});
	it.each([
		"ja.japanese#holiday@group.v.calendar.google.com",
		"en.usa.official#holiday@group.v.calendar.google.com",
	])("recognizes localized holiday IDs: %s", (id) => {
		expect(isGoogleHolidayCalendarID(id)).toBe(true);
	});
	it("does not exclude other Google subscribed calendars", () => {
		expect(
			isGoogleHolidayCalendarID("#contacts@group.v.calendar.google.com"),
		).toBe(false);
	});
});
