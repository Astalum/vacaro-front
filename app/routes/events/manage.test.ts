import { afterEach, describe, expect, it, vi } from "vitest";
import { clientAction } from "./manage";

function response(data: unknown) {
	return Promise.resolve(
		new Response(JSON.stringify({ data }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		}),
	);
}

describe("manage clientAction", () => {
	afterEach(() => vi.restoreAllMocks());

	it("enables group scheduling and creates the first group with members", async () => {
		const requests: Array<{ path: string; method: string; body: unknown }> = [];
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request, init?: RequestInit) => {
				requests.push({
					path: String(input),
					method: init?.method ?? "GET",
					body: init?.body ? JSON.parse(String(init.body)) : null,
				});
				return response({});
			}),
		);

		const formData = new FormData();
		formData.set("intent", "create-first-group");
		formData.set("name", " デザインチーム ");
		formData.set("duration_minutes", "45");
		formData.append("participant_ids", "participant-1");
		formData.append("participant_ids", "participant-2");

		const result = await clientAction({
			params: { eventId: "event-1" },
			request: new Request("https://vacaro.test/events/event-1/manage", {
				method: "POST",
				body: formData,
			}),
		} as Parameters<typeof clientAction>[0]);

		expect(requests).toEqual([
			{
				path: "/api/v1/events/event-1",
				method: "PATCH",
				body: { scheduling_mode: "groups" },
			},
			{
				path: "/api/v1/events/event-1/groups",
				method: "POST",
				body: {
					name: "デザインチーム",
					duration_minutes: 45,
					participant_ids: ["participant-1", "participant-2"],
				},
			},
		]);
		expect(result).toEqual({
			success: "小グループ方式へ切り替えて作成しました",
		});
	});
});
