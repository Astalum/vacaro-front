import { afterEach, describe, expect, it, vi } from "vitest";
import { clientAction } from "~/routes/account";

afterEach(() => vi.unstubAllGlobals());
describe("iCloud connection action", () => {
	it("sends credentials only in the POST body and returns no password", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ data: { connected: true } }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		const form = new FormData();
		form.set("intent", "icloud-connect");
		form.set("apple_account", "apple@example.com");
		form.set("app_password", "aaaa-bbbb-cccc-dddd");
		const result = await clientAction({
			request: new Request("https://vacaro.test/account", {
				method: "POST",
				body: form,
			}),
		} as never);
		expect(result).toEqual({ kind: "connected", scope: "icloud" });
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/v1/integrations/icloud-calendar",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					apple_account: "apple@example.com",
					app_password: "aaaa-bbbb-cccc-dddd",
				}),
			}),
		);
		expect(JSON.stringify(result)).not.toContain("aaaa-bbbb-cccc-dddd");
	});
	it("does not return submitted credentials after a connection error", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						error: {
							code: "icloud_reconnect_required",
							message: "再接続してください",
						},
					}),
					{ status: 409, headers: { "Content-Type": "application/json" } },
				),
			),
		);
		const form = new FormData();
		form.set("intent", "icloud-connect");
		form.set("apple_account", "apple@example.com");
		form.set("app_password", "aaaa-bbbb-cccc-dddd");
		const result = await clientAction({
			request: new Request("https://vacaro.test/account", {
				method: "POST",
				body: form,
			}),
		} as never);
		expect(JSON.stringify(result)).not.toContain("aaaa-bbbb-cccc-dddd");
		expect(result).toMatchObject({
			data: { kind: "error", error: { code: "icloud_reconnect_required" } },
		});
	});
});
