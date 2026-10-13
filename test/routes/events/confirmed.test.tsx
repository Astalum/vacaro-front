// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
	ConfirmationCalendarStatus,
	Event,
	Participant,
	SchedulingGroup,
	User,
} from "~/lib/api";
import Confirmed, { clientAction } from "~/routes/events/confirmed";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const startAt = "2026-10-20T01:00:00Z";
const endAt = "2026-10-20T02:00:00Z";

function participant(
	id: string,
	userID: string,
	displayName: string,
): Participant {
	return {
		id,
		event_id: "event-1",
		user_id: userID,
		display_name: displayName,
		role: userID === "owner" ? "organizer" : "member",
		response_status: "submitted",
		created_at: "2026-10-01T00:00:00Z",
		updated_at: "2026-10-01T00:00:00Z",
	};
}

function event(overrides: Partial<Event> = {}): Event {
	return {
		id: "event-1",
		created_by_user_id: "owner",
		title: "秋の交流会",
		description: "受付前に集合してください。",
		time_zone: "Asia/Tokyo",
		window_start_at: "2026-10-20T00:00:00Z",
		window_end_at: "2026-10-20T09:00:00Z",
		duration_minutes: 60,
		scheduling_mode: "whole_event",
		status: "confirmed",
		confirmed_start_at: startAt,
		confirmed_end_at: endAt,
		response_deadline_at: null,
		results_visible_to_participants: true,
		created_at: "2026-10-01T00:00:00Z",
		updated_at: "2026-10-01T00:00:00Z",
		...overrides,
	};
}

const user: User = {
	id: "member",
	account_type: "registered",
	display_name: "参加者",
	email: "member@example.com",
	guest_expires_at: null,
	created_at: "2026-10-01T00:00:00Z",
	updated_at: "2026-10-01T00:00:00Z",
};
const participants = [
	participant("participant-1", "owner", "主催者"),
	participant("participant-2", "member", "参加者"),
];

function renderConfirmed(
	eventValue: Event,
	groups: SchedulingGroup[],
	calendarStatus: ConfirmationCalendarStatus,
) {
	const RouterStub = createRoutesStub([
		{
			path: "/events/:eventId/confirmed",
			loader: () => ({
				event: eventValue,
				user,
				participants,
				groups,
				calendarStatus,
			}),
			Component: Confirmed,
		},
	]);
	render(<RouterStub initialEntries={["/events/event-1/confirmed"]} />);
}

describe("confirmed schedule screen", () => {
	it("shows participants and an automatic calendar sync failure", async () => {
		renderConfirmed(event(), [], {
			connection_status: "connected",
			syncs: [
				{
					group_id: null,
					status: "failed",
					attempted_at: "2026-10-12T00:00:00Z",
				},
			],
		});

		expect(await screen.findByText("主催者")).toBeTruthy();
		expect(screen.getByText("参加者", { selector: "li" })).toBeTruthy();
		expect(screen.getByText(/自動登録に失敗しました/)).toBeTruthy();
		expect(
			screen.getByRole("button", {
				name: /Googleカレンダーへの追加を再試行/,
			}),
		).toBeTruthy();
	});

	it("shows the group explanation and each group's member names", async () => {
		const group: SchedulingGroup = {
			id: "group-1",
			event_id: "event-1",
			name: "デザインチーム",
			duration_minutes: 45,
			confirmed_start_at: startAt,
			confirmed_end_at: "2026-10-20T01:45:00Z",
			member_count: 1,
			members: [participants[1]],
			created_at: "2026-10-01T00:00:00Z",
			updated_at: "2026-10-01T00:00:00Z",
		};
		renderConfirmed(
			event({
				scheduling_mode: "groups",
				confirmed_start_at: null,
				confirmed_end_at: null,
			}),
			[group],
			{ connection_status: "connected", syncs: [] },
		);

		expect(await screen.findByText("グループごとの日程について")).toBeTruthy();
		expect(screen.getByText(/グループごとに確定日時が異なります/)).toBeTruthy();
		expect(screen.getByText("受付前に集合してください。")).toBeTruthy();
		expect(screen.getByText("グループメンバー")).toBeTruthy();
		expect(screen.getAllByText("参加者").length).toBeGreaterThan(0);
	});
});

describe("confirmed schedule clientAction", () => {
	it("retries the current user's group calendar registration", async () => {
		const fetchMock = vi.fn(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({
						data: {
							group_id: "group-1",
							status: "synced",
							attempted_at: "2026-10-12T00:00:00Z",
						},
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			),
		);
		vi.stubGlobal("fetch", fetchMock);
		const formData = new FormData();
		formData.set("intent", "sync-calendar");
		formData.set("group_id", "group-1");

		const result = await clientAction({
			params: { eventId: "event-1" },
			request: new Request("https://vacaro.test/events/event-1/confirmed", {
				method: "POST",
				body: formData,
			}),
		} as Parameters<typeof clientAction>[0]);

		expect(result).toEqual({
			kind: "success",
			group_id: "group-1",
			message: "Googleカレンダーに追加しました",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/v1/events/event-1/confirmation-calendar",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ group_id: "group-1" }),
			}),
		);
	});
});
