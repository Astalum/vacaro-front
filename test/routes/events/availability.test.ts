import { afterEach, describe, expect, it, vi } from "vitest";
import {
	clientAction,
	clientLoader,
	invertRangesForWindow,
} from "~/routes/events/availability";

describe("availability clientAction", () => {
	it("removes holidays from submitted calendar IDs before requesting a preview", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ data: { intervals: [] } }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		const formData = new FormData();
		formData.set("intent", "calendar-preview");
		formData.set(
			"calendar_ids",
			JSON.stringify([
				"main",
				"ja.japanese.official#holiday@group.v.calendar.google.com",
				"work",
			]),
		);
		await clientAction({
			params: { eventId: "event-1" },
			request: new Request("http://localhost/events/event-1/availability", {
				method: "POST",
				body: formData,
			}),
		} as never);
		expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
			calendar_ids: ["main", "work"],
		});
	});

	afterEach(() => vi.unstubAllGlobals());

	it.each([
		{ intent: "save", expectedCount: 1 },
		{ intent: "none", expectedCount: 0 },
	])(
		"reports success after $intent succeeds",
		async ({ intent, expectedCount }) => {
			const fetchMock = vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						data: { response_status: "submitted", intervals: [] },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			);
			vi.stubGlobal("fetch", fetchMock);
			const formData = new FormData();
			formData.set("intent", intent);
			formData.set(
				"intervals",
				JSON.stringify([
					{
						id: "range-1",
						start: "2026-10-03T09:00",
						end: "2026-10-03T10:00",
					},
				]),
			);

			const result = await clientAction({
				params: { eventId: "event-1" },
				request: new Request("http://localhost/events/event-1/availability", {
					method: "POST",
					body: formData,
				}),
			} as never);

			expect(result).toEqual({ kind: "saved" });
			const request = fetchMock.mock.calls[0];
			expect(request[0]).toBe("/api/v1/events/event-1/my-availability");
			const body = JSON.parse(String(request[1]?.body));
			expect(body.intervals).toHaveLength(expectedCount);
		},
	);

	it("issues and saves a response edit link", async () => {
		const responseEditUrl =
			"https://vacaro.test/responses/edit#abcdefghijklmnopqrstuvwxyzABCDEFGH123456789";
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({ data: { response_edit_url: responseEditUrl } }),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			),
		);
		vi.stubGlobal("fetch", fetchMock);
		const formData = new FormData();
		formData.set("intent", "issue-response-edit-link");

		const result = await clientAction({
			params: { eventId: "event-1" },
			request: new Request("http://localhost/events/event-1/availability", {
				method: "POST",
				body: formData,
			}),
		} as never);

		expect(fetchMock.mock.calls[0][0]).toBe(
			"/api/v1/events/event-1/response-edit-link",
		);
		expect(result).toEqual({ kind: "response-link", responseEditUrl });
	});

	it("copies an answer from another event", async () => {
		const intervals = [
			{
				id: "copied-1",
				start_at: "2026-10-03T00:00:00Z",
				end_at: "2026-10-03T01:00:00Z",
			},
		];
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					data: { response_status: "submitted", intervals },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);
		vi.stubGlobal("fetch", fetchMock);
		const formData = new FormData();
		formData.set("intent", "copy-availability");
		formData.set("source_event_id", "source-event");

		const result = await clientAction({
			params: { eventId: "target-event" },
			request: new Request(
				"http://localhost/events/target-event/availability",
				{ method: "POST", body: formData },
			),
		} as never);

		expect(fetchMock.mock.calls[0][0]).toBe(
			"/api/v1/events/target-event/my-availability/copy",
		);
		expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
			source_event_id: "source-event",
		});
		expect(result).toEqual({ kind: "copied", intervals });
	});

	it("saves local ranges using the event time zone", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					data: { response_status: "submitted", intervals: [] },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);
		vi.stubGlobal("fetch", fetchMock);
		const formData = new FormData();
		formData.set("intent", "save");
		formData.set("time_zone", "America/New_York");
		formData.set(
			"intervals",
			JSON.stringify([
				{
					id: "range-1",
					start: "2026-07-01T09:00",
					end: "2026-07-01T10:00",
				},
			]),
		);

		await clientAction({
			params: { eventId: "event-1" },
			request: new Request("http://localhost/events/event-1/availability", {
				method: "POST",
				body: formData,
			}),
		} as never);

		expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
			intervals: [
				{
					start_at: "2026-07-01T13:00:00.000Z",
					end_at: "2026-07-01T14:00:00.000Z",
				},
			],
		});
	});
});

describe("invertRangesForWindow", () => {
	it("returns the available gaps inside each daily response window", () => {
		const result = invertRangesForWindow(
			[
				{
					id: "unavailable-1",
					start: "2026-10-03T10:00",
					end: "2026-10-03T12:00",
				},
				{
					id: "unavailable-2",
					start: "2026-10-03T13:00",
					end: "2026-10-03T15:00",
				},
			],
			"2026-10-03",
			"2026-10-03",
			9 * 60,
			21 * 60,
		);

		expect(result.map(({ start, end }) => ({ start, end }))).toEqual([
			{ start: "2026-10-03T09:00", end: "2026-10-03T10:00" },
			{ start: "2026-10-03T12:00", end: "2026-10-03T13:00" },
			{ start: "2026-10-03T15:00", end: "2026-10-03T21:00" },
		]);
	});

	it("restores the original intervals after switching modes twice", () => {
		const original = [
			{
				id: "available-1",
				start: "2026-10-03T10:00",
				end: "2026-10-03T12:00",
			},
		];
		const unavailable = invertRangesForWindow(
			original,
			"2026-10-03",
			"2026-10-03",
			9 * 60,
			21 * 60,
		);
		const restored = invertRangesForWindow(
			unavailable,
			"2026-10-03",
			"2026-10-03",
			9 * 60,
			21 * 60,
		);

		expect(restored.map(({ start, end }) => ({ start, end }))).toEqual([
			{ start: original[0].start, end: original[0].end },
		]);
	});
});

describe("availability clientLoader response identity", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("uses the event response user when a different account is signed in", async () => {
		const responseUser = {
			id: "response-guest",
			account_type: "guest",
			time_zone: "Asia/Tokyo",
		};
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockImplementation(async (input) => {
				const path = String(input);
				let data: unknown = [];
				if (path.endsWith("/calendar-preference")) data = { provider: "none" };
				else if (path.endsWith("/response-user")) data = responseUser;
				else if (path.endsWith("/me"))
					data = {
						id: "other-account",
						account_type: "registered",
						time_zone: "America/New_York",
					};
				else if (path.endsWith("/calendars")) data = { calendars: [] };
				else if (path.endsWith("/my-availability"))
					data = { response_status: "pending", intervals: [] };
				else if (path.endsWith("/event-1"))
					data = { id: "event-1", title: "Event" };
				return new Response(JSON.stringify({ data }));
			});
		vi.stubGlobal("fetch", fetchMock);
		const loaded = await clientLoader({
			params: { eventId: "event-1" },
		} as never);
		expect(loaded.user).toEqual(responseUser);
		expect(
			fetchMock.mock.calls.some(([input]) => String(input).endsWith("/me")),
		).toBe(false);
	});
});

it("imports iCloud intervals from the iCloud endpoint", async () => {
	const intervals = [
		{
			start_at: "2026-11-15T01:00:00Z",
			end_at: "2026-11-15T02:00:00Z",
			source: "icloud_calendar",
		},
	];
	const fetchMock = vi.fn().mockResolvedValue(
		new Response(JSON.stringify({ data: { intervals } }), {
			headers: { "Content-Type": "application/json" },
		}),
	);
	vi.stubGlobal("fetch", fetchMock);
	const form = new FormData();
	form.set("intent", "icloud-calendar-preview");
	form.set("icloud_calendar_ids", JSON.stringify(["icloud-personal"]));
	const result = await clientAction({
		params: { eventId: "event-1" },
		request: new Request("https://vacaro.test/events/event-1/availability", {
			method: "POST",
			body: form,
		}),
	} as never);
	expect(result).toEqual({ kind: "preview", intervals });
	expect(fetchMock).toHaveBeenCalledWith(
		"/api/v1/events/event-1/icloud-calendar-availability/preview",
		expect.objectContaining({
			method: "POST",
			body: JSON.stringify({ calendar_ids: ["icloud-personal"] }),
		}),
	);
	vi.unstubAllGlobals();
});
