import { afterEach, describe, expect, it, vi } from "vitest";
import { clientAction } from "~/routes/events/edit";

describe("edit event clientAction", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("updates scheduling mode, arbitrary duration, and IANA-zone dates", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ data: { id: "event-1" } }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		const formData = new FormData();
		formData.set("title", "海外チーム会議");
		formData.set("description", "");
		formData.set("time_zone", "Europe/Paris");
		formData.set("window_start_date", "2026-07-01");
		formData.set("window_end_date", "2026-07-02");
		formData.set("daily_start_time", "09:00");
		formData.set("daily_end_time", "17:00");
		formData.set("duration_minutes", "47");
		formData.set("scheduling_mode", "whole_event");

		const result = await clientAction({
			params: { eventId: "event-1" },
			request: new Request("https://vacaro.test/events/event-1/edit", {
				method: "POST",
				body: formData,
			}),
		} as never);

		expect(result).toBeInstanceOf(Response);
		expect((result as Response).headers.get("Location")).toBe(
			"/events/event-1/manage",
		);
		const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
		expect(body).toMatchObject({
			window_start_at: "2026-07-01T07:00:00.000Z",
			window_end_at: "2026-07-02T15:00:00.000Z",
			duration_minutes: 47,
			scheduling_mode: "whole_event",
		});
	});
});
