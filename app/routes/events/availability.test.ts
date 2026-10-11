import { afterEach, describe, expect, it, vi } from "vitest";
import { clientAction, invertRangesForWindow } from "./availability";

describe("availability clientAction", () => {
	afterEach(() => vi.unstubAllGlobals());

	it.each([
		{ intent: "save", expectedCount: 1 },
		{ intent: "none", expectedCount: 0 },
	])(
		"redirects to the event list after $intent succeeds",
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

			const response = await clientAction({
				params: { eventId: "event-1" },
				request: new Request("http://localhost/events/event-1/availability", {
					method: "POST",
					body: formData,
				}),
			} as never);

			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(302);
			expect((response as Response).headers.get("Location")).toBe("/events");
			const request = fetchMock.mock.calls[0];
			expect(request[0]).toBe("/api/v1/events/event-1/my-availability");
			const body = JSON.parse(String(request[1]?.body));
			expect(body.intervals).toHaveLength(expectedCount);
		},
	);

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
