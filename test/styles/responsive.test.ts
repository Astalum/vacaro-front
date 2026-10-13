// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
	new URL("../../app/styles/responsive.scss", import.meta.url),
	"utf8",
);

describe("mobile header navigation styles", () => {
	it("keeps page content from bleeding through the open menu", () => {
		expect(styles).toMatch(
			/\/\* Navigation becomes a touch-friendly menu on phones\. \*\/[\s\S]*?\.app-header\s*\{[^}]*-webkit-backdrop-filter:\s*none[^}]*backdrop-filter:\s*none/,
		);
		expect(styles).toMatch(
			/\.app-header\s+nav\s*\{[^}]*background:\s*var\(--white\)/,
		);
	});

	it("does not hide non-button navigation links on phones", () => {
		expect(styles).not.toMatch(
			/\.app-header\s+nav\s*>\s*a:not\(\.button\)\s*\{[^}]*display:\s*none/,
		);
	});

	it("renders every direct navigation link as a full-width menu item", () => {
		expect(styles).toMatch(
			/\.app-header\s+nav\s*>\s*a,[\s\S]*?\.app-header\s+nav\s*>\s*\.account-link\s*\{[^}]*width:\s*100%[^}]*min-height:\s*48px[^}]*display:\s*flex[^}]*align-items:\s*center/,
		);
	});

	it("keeps the create action aligned with the other menu items", () => {
		expect(styles).toMatch(
			/\.app-header\s+nav\s+\.event-create-button\s*\{[^}]*margin:\s*0\s+0\s+4px[^}]*box-shadow:\s*none/,
		);
		expect(styles).not.toMatch(
			/\.app-header\s+nav\s+\.button\s*\{[^}]*margin-top:\s*5px/,
		);
	});
});
