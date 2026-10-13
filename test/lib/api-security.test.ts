import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "~/lib/api";

describe("API request CSRF protection", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("adds the same-origin proof header to state-changing requests", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ data: { ok: true } }), {
				headers: { "Content-Type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await apiRequest("/test", { method: "POST", body: "{}" });

		const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
		expect(headers.get("X-Vacaro-CSRF")).toBe("same-origin");
	});

	it("does not add the proof header to safe requests", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ data: { ok: true } }), {
				headers: { "Content-Type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await apiRequest("/test");

		const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
		expect(headers.has("X-Vacaro-CSRF")).toBe(false);
	});
});
