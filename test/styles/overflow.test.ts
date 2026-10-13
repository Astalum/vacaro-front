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
		expect(edit).toMatch(
			/\.daily-window-fields input\[type="time"\]\s*\{[^}]*display:\s*block[^}]*max-width:\s*100%/,
		);
	});

	it.each([
		[
			"account",
			"../../app/styles/routes/account.scss",
			".settings-time-window input",
		],
		[
			"availability",
			"../../app/styles/routes/events/availability.scss",
			".schedule-time-row input",
		],
		[
			"results",
			"../../app/styles/routes/events/results.scss",
			".manual-confirmation-time",
		],
	])("constrains raw time inputs on the %s page", (_, path, selector) => {
		const styles = read(path);
		const escapedSelector = selector
			.replaceAll(".", "\\.")
			.replaceAll(" ", "\\s+");

		expect(styles).toMatch(
			new RegExp(
				`${escapedSelector}\\s*\\{[^}]*display:\\s*block[^}]*min-width:\\s*0[^}]*max-width:\\s*100%`,
			),
		);
	});
});
