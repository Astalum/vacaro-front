import { afterEach, describe, expect, it, vi } from "vitest";
import {
	savedCalendarAvailabilityWindow,
	saveCalendarAvailabilityWindow,
} from "~/features/calendars/import-window";
import { validateEventForm } from "~/features/events/form-validation";
import { clientAction as createEvent } from "~/routes/events/new";
import { clientAction as editEvent } from "~/routes/events/edit";
import { clientAction as saveAvailability } from "~/routes/events/availability";
import { clientAction as confirmEvent } from "~/routes/events/results";

function form() {
	const f = new FormData();
	for (const [key, value] of Object.entries({
		title: "Meeting",
		display_name: "User",
		time_zone: "Asia/Tokyo",
		window_start_date: "2026-12-31",
		window_end_date: "2026-12-31",
		daily_start_time: "09:00",
		daily_end_time: "24:00",
		duration_minutes: "60",
		scheduling_mode: "whole_event",
		response_deadline_at: "2027-01-01T00:00",
	}))
		f.set(key, value);
	return f;
}
function args(f: FormData) {
	return {
		params: { eventId: "event-1" },
		request: new Request("https://vacaro.test/events/event-1", {
			method: "POST",
			body: f,
		}),
	} as never;
}
function mockAPI() {
	const fetchMock = vi.fn().mockImplementation(() =>
		Promise.resolve(
			new Response(
				JSON.stringify({
					data: {
						id: "event-1",
						display_name: "User",
						time_zone: "Asia/Tokyo",
						invite_url: "https://vacaro.test/invitations/test",
					},
				}),
				{ headers: { "Content-Type": "application/json" } },
			),
		),
	);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}
afterEach(() => {
	vi.unstubAllGlobals();
	window.localStorage.clear();
});

describe("24:00 through form submission", () => {
	it("validates equivalent midnight deadlines and keeps range ordering", () => {
		const f = form();
		expect(validateEventForm(f)).toEqual({});
		f.set("response_deadline_at", "2027-01-01T00:01");
		expect(validateEventForm(f).response_deadline_at).toBeTruthy();
		f.set("daily_end_time", "24:01");
		expect(validateEventForm(f).daily_end_time).toBeTruthy();
		f.set("daily_start_time", "24:00");
		f.set("daily_end_time", "24:00");
		expect(validateEventForm(f).daily_end_time).toContain("より後");
	});
	for (const [name, action] of [
		["create", createEvent],
		["edit", editEvent],
	] as const) {
		it(`${name}: sends midnight as UTC and allows an equivalent deadline`, async () => {
			const fetchMock = mockAPI();
			const result = await action(args(form()));
			expect(result).toBeInstanceOf(Response);
			const call = fetchMock.mock.calls.find(
				([, init]) => init?.method === (name === "create" ? "POST" : "PATCH"),
			)!;
			expect(JSON.parse(call[1].body)).toMatchObject({
				window_start_at: "2026-12-31T00:00:00.000Z",
				window_end_at: "2026-12-31T15:00:00.000Z",
				response_deadline_at: "2026-12-31T15:00:00.000Z",
			});
		});
		it(`${name}: rejects 24:01 and deadlines beyond midnight without writing`, async () => {
			const fetchMock = mockAPI();
			const f = form();
			f.set("daily_end_time", "24:01");
			expect(
				((await action(args(f))) as { init: { status: number } }).init.status,
			).toBe(422);
			f.set("daily_end_time", "24:00");
			f.set("response_deadline_at", "2027-01-01T00:01");
			expect(
				((await action(args(f))) as { init: { status: number } }).init.status,
			).toBe(422);
			expect(fetchMock).not.toHaveBeenCalled();
		});
	}
	it("saves availability with a 24:00 endpoint", async () => {
		const fetchMock = mockAPI();
		const f = new FormData();
		f.set("intent", "save");
		f.set("time_zone", "Asia/Tokyo");
		f.set(
			"intervals",
			JSON.stringify([{ start: "2026-12-31T23:00", end: "2026-12-31T24:00" }]),
		);
		expect(await saveAvailability(args(f))).toEqual({ kind: "saved" });
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
			intervals: [
				{
					start_at: "2026-12-31T14:00:00.000Z",
					end_at: "2026-12-31T15:00:00.000Z",
				},
			],
		});
	});
	it("confirms a meeting starting at 24:00", async () => {
		const fetchMock = mockAPI();
		const f = new FormData();
		f.set("intent", "confirm");
		f.set("time_zone", "Asia/Tokyo");
		f.set("confirmation_date", "2026-12-31");
		f.set("confirmation_time", "24:00");
		f.set("duration_minutes", "60");
		await confirmEvent(args(f));
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
			start_at: "2026-12-31T15:00:00.000Z",
			end_at: "2026-12-31T16:00:00.000Z",
		});
	});
	it("persists and reloads a calendar import window through 24:00", () => {
		expect(
			saveCalendarAvailabilityWindow({ start: "09:00", end: "24:00" }),
		).toBe(true);
		expect(savedCalendarAvailabilityWindow()).toEqual({
			start: "09:00",
			end: "24:00",
		});
		expect(
			saveCalendarAvailabilityWindow({ start: "09:00", end: "24:01" }),
		).toBe(false);
	});
});
