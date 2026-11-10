import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteUrlReissue } from "~/features/events/invite-url";

describe("InviteUrlReissue", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("warns that the saved URL stays valid and requires confirmation", async () => {
		const user = userEvent.setup();
		const action = vi.fn(() => ({ ok: true }));
		const confirm = vi.fn(() => false);
		vi.stubGlobal("confirm", confirm);
		const RouterStub = createRoutesStub([
			{
				path: "/events/event-1/manage",
				Component: () => (
					<InviteUrlReissue hasInviteUrl={false} canReissue busy={false} />
				),
				action,
			},
		]);

		render(<RouterStub initialEntries={["/events/event-1/manage"]} />);

		expect(screen.getByText(/共有済みのURLは引き続き有効です/)).toBeTruthy();
		const button = screen.getByRole("button", { name: /招待URLを再発行/ });
		await user.click(button);
		expect(confirm).toHaveBeenCalledTimes(1);
		expect(action).not.toHaveBeenCalled();

		confirm.mockReturnValue(true);
		await user.click(button);
		await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
	});
});
