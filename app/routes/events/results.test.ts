import { afterEach, describe, expect, it, vi } from "vitest";
import type { Event, SchedulingGroup, User } from "../../lib/api";
import { clientAction, clientLoader } from "./results";

function response(data: unknown) {
	return Promise.resolve(
		new Response(JSON.stringify({ data }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		}),
	);
}

describe("results clientLoader", () => {
	afterEach(() => vi.restoreAllMocks());

	it("loads candidates and availability for the group selected in the URL", async () => {
		const event = {
			id: "event-1",
			created_by_user_id: "user-1",
			title: "グループ調整",
			description: null,
			time_zone: "Asia/Tokyo",
			window_start_at: "2026-09-10T00:00:00Z",
			window_end_at: "2026-09-12T00:00:00Z",
			duration_minutes: 60,
			scheduling_mode: "groups",
			status: "open",
			confirmed_start_at: null,
			confirmed_end_at: null,
			response_deadline_at: null,
			created_at: "2026-09-01T00:00:00Z",
			updated_at: "2026-09-01T00:00:00Z",
		} satisfies Event;
		const user = { id: "user-1" } as User;
		const groupBase = {
			event_id: event.id,
			duration_minutes: 60,
			confirmed_start_at: null,
			confirmed_end_at: null,
			member_count: 0,
			members: [],
			created_at: "2026-09-01T00:00:00Z",
			updated_at: "2026-09-01T00:00:00Z",
		} satisfies Omit<SchedulingGroup, "id" | "name">;
		const groups: SchedulingGroup[] = [
			{ ...groupBase, id: "group-1", name: "A" },
			{ ...groupBase, id: "group-2", name: "B" },
		];
		const requestedPaths: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request) => {
				const path = String(input);
				requestedPaths.push(path);
				if (path.endsWith("/events/event-1")) return response(event);
				if (path.endsWith("/me")) return response(user);
				if (path.endsWith("/events/event-1/groups")) return response(groups);
				return response([]);
			}),
		);

		const loaded = await clientLoader({
			params: { eventId: event.id },
			request: new Request(
				"https://vacaro.test/events/event-1/results?group_id=group-2",
			),
		} as Parameters<typeof clientLoader>[0]);

		expect(loaded).not.toBeInstanceOf(Response);
		if (loaded instanceof Response) throw new Error("unexpected redirect");
		expect(loaded.activeGroup?.id).toBe("group-2");
		expect(requestedPaths).toContain(
			"/api/v1/events/event-1/groups/group-2/candidates?limit=100",
		);
		expect(requestedPaths).toContain(
			"/api/v1/events/event-1/groups/group-2/availability",
		);
	});

	it("loads whole-event candidates and availability when whole is selected", async () => {
		const event = {
			id: "event-1",
			created_by_user_id: "user-1",
			title: "グループ調整",
			description: null,
			time_zone: "Asia/Tokyo",
			window_start_at: "2026-09-10T00:00:00Z",
			window_end_at: "2026-09-12T00:00:00Z",
			duration_minutes: 60,
			scheduling_mode: "groups",
			status: "open",
			confirmed_start_at: null,
			confirmed_end_at: null,
			response_deadline_at: null,
			created_at: "2026-09-01T00:00:00Z",
			updated_at: "2026-09-01T00:00:00Z",
		} satisfies Event;
		const requestedPaths: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request) => {
				const path = String(input);
				requestedPaths.push(path);
				if (path.endsWith("/events/event-1")) return response(event);
				if (path.endsWith("/me")) return response({ id: "user-1" });
				if (path.endsWith("/events/event-1/groups")) return response([]);
				return response([]);
			}),
		);

		const loaded = await clientLoader({
			params: { eventId: event.id },
			request: new Request(
				"https://vacaro.test/events/event-1/results?scope=whole",
			),
		} as Parameters<typeof clientLoader>[0]);

		expect(loaded).not.toBeInstanceOf(Response);
		if (loaded instanceof Response) throw new Error("unexpected redirect");
		expect(loaded.activeGroup).toBeNull();
		expect(requestedPaths).toContain(
			"/api/v1/events/event-1/candidates?limit=100",
		);
		expect(requestedPaths).toContain("/api/v1/events/event-1/availability");
	});
});

describe("results clientAction", () => {
	afterEach(() => vi.restoreAllMocks());

	it("confirms the whole event when no group is selected", async () => {
		const fetchMock = vi.fn(() => response({ status: "confirmed" }));
		vi.stubGlobal("fetch", fetchMock);
		const formData = new FormData();
		formData.set("intent", "confirm");
		formData.set("group_id", "");
		formData.set("start_at", "2026-09-10T01:00:00Z");
		formData.set("end_at", "2026-09-10T02:00:00Z");

		const result = await clientAction({
			params: { eventId: "event-1" },
			request: new Request("https://vacaro.test/events/event-1/results", {
				method: "POST",
				body: formData,
			}),
		} as Parameters<typeof clientAction>[0]);

		expect(result).toEqual({ success: "開催日時を確定しました" });
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/v1/events/event-1/confirmation",
			expect.objectContaining({ method: "PUT" }),
		);
	});

	it("cancels the selected group's confirmation", async () => {
		const fetchMock = vi.fn(() => response({ confirmed_start_at: null }));
		vi.stubGlobal("fetch", fetchMock);
		const formData = new FormData();
		formData.set("intent", "unconfirm");
		formData.set("group_id", "group-1");

		const result = await clientAction({
			params: { eventId: "event-1" },
			request: new Request("https://vacaro.test/events/event-1/results", {
				method: "POST",
				body: formData,
			}),
		} as Parameters<typeof clientAction>[0]);

		expect(result).toEqual({ success: "確定を取り消しました" });
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/v1/events/event-1/groups/group-1/confirmation",
			expect.objectContaining({ method: "DELETE" }),
		);
	});
});
