// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./home";

describe("Home OAuth notice", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
		);
	});

	afterEach(() => vi.unstubAllGlobals());

	it("shows a readable error after a failed Google login callback", async () => {
		const RouterStub = createRoutesStub([{ path: "/", Component: Home }]);

		render(<RouterStub initialEntries={["/?google_login=error"]} />);

		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toContain(
			"Googleログインを完了できませんでした。もう一度お試しください。",
		);
	});
});
