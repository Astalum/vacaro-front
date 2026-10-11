// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Event } from "../../lib/api";
import EventsIndex, { clientLoader, EventList } from "./index";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

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

describe("event list pagination", () => {
	it("keeps the API next cursor in the client loader result", async () => {
		const fetchMock = vi.fn((input: string | URL | Request) => {
			const path = String(input);
			if (path === "/api/v1/me") {
				return Promise.resolve(
					new Response(JSON.stringify({ data: { id: "member-1" } }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					}),
				);
			}
			return Promise.resolve(
				new Response(
					JSON.stringify({
						data: [event()],
						meta: { next_cursor: "cursor-20" },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await clientLoader({
			request: new Request("https://vacaro.test/events"),
		} as Parameters<typeof clientLoader>[0]);

		expect(result.nextCursor).toBe("cursor-20");
		expect(result.events).toHaveLength(1);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/v1/events?limit=20",
			expect.any(Object),
		);
	});

	it("returns a retryable error when loading an additional page fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request) => {
				if (String(input) === "/api/v1/me") {
					return Promise.resolve(
						new Response(JSON.stringify({ data: { id: "member-1" } }), {
							status: 200,
							headers: { "Content-Type": "application/json" },
						}),
					);
				}
				return Promise.resolve(
					new Response(
						JSON.stringify({
							error: {
								code: "temporary_failure",
								message: "イベントを読み込めませんでした",
							},
						}),
						{ status: 503, headers: { "Content-Type": "application/json" } },
					),
				);
			}),
		);

		const result = await clientLoader({
			request: new Request("https://vacaro.test/events?cursor=cursor-20"),
		} as Parameters<typeof clientLoader>[0]);

		expect(result.requestedCursor).toBe("cursor-20");
		expect(result.events).toEqual([]);
		expect(result.error?.message).toBe("イベントを読み込めませんでした");
	});

	it("appends the next page and removes the load-more button at the end", async () => {
		const first = event({ id: "event-1", title: "1件目" });
		const twentyFirst = event({ id: "event-21", title: "21件目" });
		const RouterStub = createRoutesStub([
			{
				path: "/events",
				loader: ({ request }) => {
					const cursor = new URL(request.url).searchParams.get("cursor");
					return cursor
						? {
								events: [twentyFirst],
								currentUserId: "member-1",
								nextCursor: null,
								requestedCursor: cursor,
								error: null,
							}
						: {
								events: [first],
								currentUserId: "member-1",
								nextCursor: "cursor-20",
								requestedCursor: null,
								error: null,
							};
				},
				Component: EventsIndex,
			},
		]);
		render(<RouterStub initialEntries={["/events"]} />);

		expect(await screen.findByText("1件目")).toBeTruthy();
		await userEvent.click(
			screen.getByRole("button", { name: "さらに読み込む" }),
		);

		expect(await screen.findByText("21件目")).toBeTruthy();
		expect(screen.getByText("1件目")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "さらに読み込む" })).toBeNull();
	});
});
