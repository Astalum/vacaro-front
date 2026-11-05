import { cleanup, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { createRoutesStub } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import EditResponseSession, {
	responseEditTokenFromHash,
} from "~/routes/responses/edit";

describe("responseEditTokenFromHash", () => {
	it("accepts a 32-byte base64url token from the URL fragment", () => {
		expect(
			responseEditTokenFromHash("#abcdefghijklmnopqrstuvwxyzABCDEFGH123456789"),
		).toBe("abcdefghijklmnopqrstuvwxyzABCDEFGH123456789");
	});

	it.each(["", "#short", "#invalid/token+characters================"])(
		"rejects an invalid fragment: %s",
		(hash) => {
			expect(responseEditTokenFromHash(hash)).toBeNull();
		},
	);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	window.history.replaceState(null, "", "/");
	window.localStorage.clear();
});

describe("response edit session", () => {
	it("exchanges a fragment once and opens the answer under StrictMode", async () => {
		const token = "abcdefghijklmnopqrstuvwxyzABCDEFGH123456789";
		window.history.replaceState(null, "", `/responses/edit#${token}`);
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockImplementation(async (input) => {
				if (String(input).endsWith("/response-sessions")) {
					return new Response(
						JSON.stringify({ data: { event_id: "event-1" } }),
					);
				}
				return new Response(
					JSON.stringify({
						error: { code: "unauthorized", message: "No session" },
					}),
					{ status: 401 },
				);
			});
		vi.stubGlobal("fetch", fetchMock);
		const Router = createRoutesStub([
			{ path: "/responses/edit", Component: EditResponseSession },
			{
				path: "/events/:eventId/availability",
				Component: () => <h1>回答画面</h1>,
			},
		]);
		render(
			<StrictMode>
				<Router initialEntries={[`/responses/edit#${token}`]} />
			</StrictMode>,
		);

		expect(
			await screen.findByRole("heading", { name: "回答画面" }),
		).toBeTruthy();
		const exchanges = fetchMock.mock.calls.filter(([input]) =>
			String(input).endsWith("/response-sessions"),
		);
		expect(exchanges).toHaveLength(1);
		expect(JSON.parse(String(exchanges[0][1]?.body))).toEqual({ token });
		expect(window.location.hash).toBe("");
	});
});
