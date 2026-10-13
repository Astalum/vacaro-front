// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
	readFileSync(new URL(relativePath, import.meta.url), "utf8");

describe("responsive overflow safeguards", () => {
	it("does not impose a viewport-wide minimum and wraps long content", () => {
		const foundation = read("../../app/styles/foundation.scss");

		expect(foundation).toMatch(
			/body\s*\{[^}]*min-width:\s*0[^}]*overflow-wrap:\s*anywhere/,
		);
		expect(foundation).not.toMatch(/body\s*\{[^}]*min-width:\s*320px/);
	});

	it("keeps shared form fields within their containers", () => {
		const forms = read("../../app/styles/forms.scss");

		expect(forms).toMatch(/\.field\s*\{[^}]*min-width:\s*0/);
		expect(forms).toMatch(
			/\.field input,\s*\.field textarea\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%/,
		);
	});

	it("stacks event editing time fields on narrow screens", () => {
		const edit = read("../../app/styles/routes/events/edit.scss");

		expect(edit).toMatch(
			/@media\s*\(max-width:\s*560px\)[\s\S]*?\.daily-window-fields\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
		);
	});

	it("keeps the results calendar and empty state inside phone viewports", () => {
		const results = read("../../app/styles/routes/events/results.scss");
		const responsive = read("../../app/styles/responsive.scss");

		expect(results).toMatch(
			/\.candidate-options-panel\s+\.empty-state\.calendar-empty-state\s*\{[^}]*width:\s*auto[^}]*margin:\s*16px\s+0\s+0/,
		);
		expect(responsive).toMatch(
			/@media\s*\(max-width:\s*680px\)[\s\S]*?\.results-two-column\s+\.schedule-calendar-shell\s+\.schedule-calendar\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/,
		);
		expect(responsive).toMatch(
			/\.candidate-options-panel\s+\.empty-state\.calendar-empty-state\s*\{[^}]*width:\s*auto[^}]*margin:\s*12px\s+0\s+0/,
		);
	});

	it("keeps the custom time picker within every form container", () => {
		const picker = read("../../app/components/ui/time-picker.tsx");
		const account = read("../../app/styles/routes/account.scss");
		const results = read("../../app/styles/routes/events/results.scss");

		expect(picker).toContain("w-full min-w-0 max-w-full");
		expect(account).toMatch(
			/\.settings-time-window button\[data-slot="popover-trigger"\]\s*\{[^}]*display:\s*flex[^}]*width:\s*100%[^}]*min-width:\s*0[^}]*max-width:\s*100%/,
		);
		expect(results).toMatch(
			/\.manual-confirmation-time\s*\{[^}]*display:\s*flex[^}]*width:\s*100%[^}]*min-width:\s*0[^}]*max-width:\s*100%/,
		);
	});
});
