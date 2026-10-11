// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import type { Event } from "../../lib/api";
import { EventList } from "./index";

afterEach(cleanup);

function event(overrides: Partial<Event> = {}): Event {
	return {
		id: "event-1",
		created_by_user_id: "organizer-1",
		title: "秋の交流会",
		description: null,
		time_zone: "Asia/Tokyo",
		window_start_at: "2099-10-20T00:00:00Z",
		window_end_at: "2099-10-20T09:00:00Z",
		duration_minutes: 60,
		scheduling_mode: "groups",
		status: "open",
		confirmed_start_at: null,
		confirmed_end_at: null,
		response_deadline_at: null,
		results_visible_to_participants: true,
		created_at: "2026-10-11T00:00:00Z",
		updated_at: "2026-10-11T00:00:00Z",
		...overrides,
	};
}

function renderEvent(item: Event, currentUserId = "member-1") {
	const RouterStub = createRoutesStub([
		{
			path: "/events",
			Component: () => (
				<EventList events={[item]} currentUserId={currentUserId} />
			),
		},
	]);

	render(<RouterStub initialEntries={["/events"]} />);
}

describe("EventList navigation", () => {
	it("shows answer and results links to a participant while results are public", () => {
		renderEvent(event());

		expect(
			screen.getByRole("link", { name: /回答ページへ/ }).getAttribute("href"),
		).toBe("/events/event-1/availability");
		expect(
			screen.getByRole("link", { name: /回答結果を見る/ }).getAttribute("href"),
		).toBe("/events/event-1/results");
		expect(screen.queryByRole("link", { name: /管理画面へ/ })).toBeNull();
	});

	it("hides the results link from a participant while results are private", () => {
		renderEvent(event({ results_visible_to_participants: false }));

		expect(screen.getByRole("link", { name: /回答ページへ/ })).toBeTruthy();
		expect(screen.queryByRole("link", { name: /回答結果を見る/ })).toBeNull();
	});

	it("keeps private results available to the organizer", () => {
		renderEvent(
			event({ results_visible_to_participants: false }),
			"organizer-1",
		);

		expect(
			screen.getByRole("link", { name: /回答結果を見る/ }).getAttribute("href"),
		).toBe("/events/event-1/results");
		expect(screen.getByRole("link", { name: /管理画面へ/ })).toBeTruthy();
	});

	it("shows the confirmed schedule to a participant independently of results visibility", () => {
		renderEvent(
			event({
				status: "confirmed",
				confirmed_start_at: "2099-10-20T01:00:00Z",
				confirmed_end_at: "2099-10-20T02:00:00Z",
				results_visible_to_participants: false,
			}),
		);

		expect(
			screen.getByRole("link", { name: /確定日時を見る/ }).getAttribute("href"),
		).toBe("/events/event-1/confirmed");
		expect(screen.queryByRole("link", { name: /回答結果を見る/ })).toBeNull();
		expect(screen.queryByRole("link", { name: /回答ページへ/ })).toBeNull();
	});
});
