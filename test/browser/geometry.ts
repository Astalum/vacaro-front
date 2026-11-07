import type { Page } from "@playwright/test";

// Measure rendered boxes, including content clipped by an outer site shell.
// A real horizontal scroll region is allowed to contain a wider calendar/table.
export async function layoutProblems(page: Page) {
	return page.evaluate(() => {
		const problems: {
			selector: string;
			kind: string;
			actual: number;
			available: number;
		}[] = [];
		const selector = (element: Element) =>
			`${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${[
				...element.classList,
			]
				.slice(0, 3)
				.map((name) => `.${name}`)
				.join(
					"",
				)} ${element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 32) ?? ""}`;
		const insideScroller = (element: Element) => {
			for (
				let parent = element.parentElement;
				parent;
				parent = parent.parentElement
			) {
				const style = getComputedStyle(parent);
				if (
					["auto", "scroll"].includes(style.overflowX) &&
					parent.scrollWidth > parent.clientWidth + 2
				)
					return true;
			}
			return false;
		};
		for (const element of document.querySelectorAll<HTMLElement>("body *")) {
			if (!(element instanceof HTMLElement)) continue;
			const style = getComputedStyle(element);
			const rect = element.getBoundingClientRect();
			if (
				!rect.width ||
				!rect.height ||
				style.visibility === "hidden" ||
				style.display === "none"
			)
				continue;
			if (
				element.closest(".hero-visual, [aria-hidden='true'], .sr-only") ||
				rect.width <= 2 ||
				rect.height <= 2
			)
				continue;
			const scrolls = insideScroller(element);
			if (element.matches(".settings-time-window .picker-trigger-value")) {
				const range = document.createRange();
				range.selectNodeContents(element);
				const lines = range.getClientRects().length;
				if (lines > 1)
					problems.push({
						selector: selector(element),
						kind: "time split across lines",
						actual: lines,
						available: 1,
					});
			}
			if (!scrolls && (rect.right > innerWidth + 2 || rect.left < -2)) {
				problems.push({
					selector: selector(element),
					kind: "outside viewport",
					actual: Math.round(rect.right),
					available: innerWidth,
				});
			}
			// Native single-line inputs scroll their text; hero illustrations and
			// step arrows intentionally extend outside their decorative boxes.
			if (
				style.overflowX === "visible" &&
				style.display !== "inline" &&
				element.clientWidth > 2 &&
				element.scrollWidth > element.clientWidth + 2 &&
				!element.matches(
					"html, body, .site-shell, .hero, .steps-grid > article, input, textarea, select",
				) &&
				!scrolls
			) {
				problems.push({
					selector: selector(element),
					kind: "content wider than box",
					actual: element.scrollWidth,
					available: element.clientWidth,
				});
			}
			if (
				element.matches(
					"input:not([type='hidden']), textarea, select, button, a.button",
				) &&
				!["absolute", "fixed"].includes(style.position)
			) {
				const parent = element.parentElement;
				if (
					parent &&
					getComputedStyle(parent).display !== "contents" &&
					!scrolls
				) {
					const bounds = parent.getBoundingClientRect();
					if (
						bounds.width &&
						(rect.left < bounds.left - 2 || rect.right > bounds.right + 2)
					)
						problems.push({
							selector: selector(element),
							kind: `outside parent ${selector(parent)}`,
							actual: Math.round(rect.width),
							available: Math.round(bounds.width),
						});
				}
			}
			if (
				element.matches("button, a.button") &&
				style.overflowY === "visible" &&
				element.scrollHeight > element.clientHeight + 3
			) {
				problems.push({
					selector: selector(element),
					kind: "text taller than control",
					actual: element.scrollHeight,
					available: element.clientHeight,
				});
			}
			if (
				element.matches(
					"[data-slot='popover-content'], [data-slot='select-content']",
				) &&
				(rect.top < -2 || rect.bottom > innerHeight + 2)
			) {
				problems.push({
					selector: selector(element),
					kind: "outside viewport height",
					actual: Math.round(rect.bottom),
					available: innerHeight,
				});
			}
			if (
				element.matches(".header-inner > *") &&
				style.position !== "absolute"
			) {
				const header = element.closest(".app-header")?.getBoundingClientRect();
				if (
					header &&
					(rect.top < header.top - 2 || rect.bottom > header.bottom + 2)
				)
					problems.push({
						selector: selector(element),
						kind: "outside header height",
						actual: Math.round(rect.height),
						available: Math.round(header.height),
					});
			}
		}
		return problems;
	});
}
