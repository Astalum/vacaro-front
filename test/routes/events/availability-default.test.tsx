import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import type { AvailabilityDefault } from "~/features/account/types";
import type { AvailabilityInterval, Event } from "~/features/events/types";
import AvailabilityPage from "~/routes/events/availability";

afterEach(cleanup);

const event: Event = {
	id: "event-1",
	title: "年末の日程調整",
	description: null,
	window_start_at: "2026-12-30T00:00:00Z",
	window_end_at: "2027-01-01T15:00:00Z",
	duration_minutes: 60,
	scheduling_mode: "whole_event",
	status: "open",
	confirmed_start_at: null,
	confirmed_end_at: null,
	response_deadline_at: null,
	results_visible_to_participants: true,
	created_at: "2026-12-01T00:00:00Z",
	updated_at: "2026-12-01T00:00:00Z",
};

async function openAvailability(
	preference: AvailabilityDefault | undefined,
	responseStatus = "pending",
	intervals: AvailabilityInterval[] = [],
) {
	const RouterStub = createRoutesStub([
		{
			path: "/events/:eventId/availability",
			Component: AvailabilityPage,
			loader: () => ({
				event,
				user: {
					id: "user-1",
					account_type: "registered",
					time_zone: "Asia/Tokyo",
					availability_default: preference,
				},
				availability: { response_status: responseStatus, intervals },
				calendarOptions: { calendars: [], error: null },
				copySourceEvents: [],
				copySourceEventsError: null,
				responseEditUrl: null,
			}),
		},
	]);
	const { container } = render(
		<RouterStub initialEntries={["/events/event-1/availability"]} />,
	);
	await screen.findByRole("button", {
		name: responseStatus === "submitted" ? "回答を更新" : "回答を保存",
	});
	return () =>
		JSON.parse(
			(container.querySelector('input[name="intervals"]') as HTMLInputElement)
				.value,
		).map(({ start, end }: { start: string; end: string }) => ({ start, end }));
}

describe("initial availability preference", () => {
	it.each([undefined, "unavailable"] as const)(
		"starts with no available time for %s",
		async (preference) => {
			const ranges = await openAvailability(preference);
			expect(ranges()).toEqual([]);
			expect(
				screen
					.getByRole("button", { name: "都合がいい時間" })
					.getAttribute("aria-pressed"),
			).toBe("true");
		},
	);

	it("starts with the complete daily window and preserves it when switching input modes", async () => {
		const user = userEvent.setup();
		const ranges = await openAvailability("available");
		const expected = [
			{ start: "2026-12-30T09:00", end: "2026-12-31T00:00" },
			{ start: "2026-12-31T09:00", end: "2027-01-01T00:00" },
			{ start: "2027-01-01T09:00", end: "2027-01-02T00:00" },
		];
		expect(ranges()).toEqual(expected);
		expect(
			screen
				.getByRole("button", { name: "都合が悪い時間" })
				.getAttribute("aria-pressed"),
		).toBe("true");
		await user.click(
			screen.getByRole("button", { name: "都合がいい時間" }),
		);
		expect(ranges()).toEqual(expected);
		await user.click(
			screen.getByRole("button", { name: "都合が悪い時間" }),
		);
		expect(ranges()).toEqual(expected);
	});

	it("preserves a submitted answer with no available time", async () => {
		const ranges = await openAvailability("available", "submitted");
		expect(ranges()).toEqual([]);
	});

	it.each(["pending", "submitted"])(
		"preserves existing intervals for a %s response",
		async (status) => {
			const ranges = await openAvailability("available", status, [
				{
					id: "existing",
					start_at: "2026-12-31T01:00:00Z",
					end_at: "2026-12-31T03:00:00Z",
				},
			]);
			expect(ranges()).toEqual([
				{ start: "2026-12-31T10:00", end: "2026-12-31T12:00" },
			]);
		},
	);
});
