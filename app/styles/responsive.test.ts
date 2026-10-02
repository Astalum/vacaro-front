// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
	new URL("./responsive.scss", import.meta.url),
	"utf8",
);

describe("mobile header navigation styles", () => {
	it("does not hide non-button navigation links on phones", () => {
		expect(styles).not.toMatch(
			/\.app-header\s+nav\s*>\s*a:not\(\.button\)\s*\{[^}]*display:\s*none/,
		);
	});

	it("renders every direct navigation link as a full-width menu item", () => {
		expect(styles).toMatch(
			/\.app-header\s+nav\s*>\s*a,[\s\S]*?\.app-header\s+nav\s*>\s*\.account-link\s*\{[^}]*width:\s*100%[^}]*display:\s*flex/,
		);
	});
});
