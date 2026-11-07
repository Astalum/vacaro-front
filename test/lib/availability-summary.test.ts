// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ParticipantAvailability } from "~/lib/api";
import { summarizeAvailability } from "~/lib/availability-summary";

const iso = (hour: number) =>
	new Date(Date.UTC(2026, 8, 10) + hour * 3_600_000).toISOString();
function answer(
	id: string,
	hours: [number, number][],
	status: "submitted" | "pending" = "submitted",
): ParticipantAvailability {
	return {
		participant: {
			id,
			event_id: "event",
			user_id: id,
			display_name: id,
			role: "member",
			response_status: status,
			created_at: iso(-24),
			updated_at: iso(-24),
		},
		intervals: hours.map(([start, end]) => ({
			start_at: iso(start),
			end_at: iso(end),
		})),
	};
}
const summarize = (answers: ParticipantAvailability[]) =>
	summarizeAvailability(answers, iso(0), iso(12), "Asia/Tokyo").get(
		"2026-09-10",
	) ?? [];
const countRanges = (answers: ParticipantAvailability[]) =>
	summarize(answers).map((range) => [
		range.start_at,
		range.end_at,
		range.available_participant_count,
	]);

describe("availability count ranges", () => {
	it("shows the full continuous answer instead of duration-sized windows", () => {
		expect(countRanges([answer("a", [[0, 8]])])).toEqual([[iso(0), iso(8), 1]]);
	});
	it("keeps one count range when members change and preserves their exact times", () => {
		const ranges = summarize([answer("a", [[0, 2]]), answer("b", [[2, 4]])]);
		expect(ranges).toHaveLength(1);
		expect(ranges[0]).toMatchObject({
			start_at: iso(0),
			end_at: iso(4),
			available_participant_count: 1,
			total_participant_count: 2,
		});
		expect(ranges[0].segments).toEqual([
			{ start_at: iso(0), end_at: iso(2), available_participant_ids: ["a"] },
			{ start_at: iso(2), end_at: iso(4), available_participant_ids: ["b"] },
		]);
	});
	it("splits exactly where the count changes, including shorter ranges", () => {
		expect(countRanges([answer("a", [[0, 4]]), answer("b", [[1, 3]])])).toEqual(
			[
				[iso(0), iso(1), 1],
				[iso(1), iso(3), 2],
				[iso(3), iso(4), 1],
			],
		);
	});
	it("does not bridge an unavailable gap with the same count on either side", () => {
		expect(
			countRanges([
				answer("a", [
					[0, 1],
					[2, 3],
				]),
			]),
		).toEqual([
			[iso(0), iso(1), 1],
			[iso(2), iso(3), 1],
		]);
	});
	it("counts overlapping and adjacent answers from one participant once", () => {
		const answers = [
			answer("a", [
				[2, 4],
				[0, 3],
				[4, 5],
			]),
		];
		const original = structuredClone(answers);
		expect(countRanges(answers)).toEqual([[iso(0), iso(5), 1]]);
		expect(summarize(answers)[0].segments).toHaveLength(1);
		expect(answers).toEqual(original);
	});
	it("clips answers to the event window and includes pending users only in the total", () => {
		const ranges = summarize([
			answer("a", [[-5, 15]]),
			answer("b", [[0, 8]], "pending"),
		]);
		expect(ranges).toHaveLength(1);
		expect(ranges[0]).toMatchObject({
			start_at: iso(0),
			end_at: iso(12),
			available_participant_count: 1,
			total_participant_count: 2,
		});
	});
	it("splits at midnight in the user's timezone", () => {
		const ranges = summarizeAvailability(
			[answer("a", [[14, 16]])],
			iso(0),
			iso(24),
			"Asia/Tokyo",
		);
		expect([...ranges.keys()]).toEqual(["2026-09-10", "2026-09-11"]);
		expect(
			[...ranges.values()]
				.flat()
				.map((range) => [range.start_at, range.end_at]),
		).toEqual([
			[iso(14), iso(15)],
			[iso(15), iso(16)],
		]);
	});
	it("uses a 23-hour local day across a daylight-saving change", () => {
		const start = "2026-03-08T04:00:00Z";
		const end = "2026-03-09T05:00:00Z";
		const user = answer("a", []);
		user.intervals = [{ start_at: start, end_at: end }];
		const ranges = summarizeAvailability(
			[user],
			start,
			end,
			"America/New_York",
		);
		expect([...ranges.keys()]).toEqual([
			"2026-03-07",
			"2026-03-08",
			"2026-03-09",
		]);
		expect(
			[...ranges.values()]
				.flat()
				.map(
					(range) =>
						(Date.parse(range.end_at) - Date.parse(range.start_at)) / 3_600_000,
				),
		).toEqual([1, 23, 1]);
	});
	it("does not truncate the result to the candidate API's 100-row limit", () => {
		const hours = Array.from({ length: 101 }, (_, index): [number, number] => [
			index / 30,
			index / 30 + 1 / 60,
		]);
		expect(summarize([answer("a", hours)])).toHaveLength(101);
	});
	it("ignores invalid and empty ranges", () => {
		const user = answer("a", [
			[0, 0],
			[4, 3],
			[-3, -2],
		]);
		user.intervals.push({ start_at: "invalid", end_at: iso(4) });
		expect(summarize([user])).toEqual([]);
		expect(summarizeAvailability([], iso(4), iso(3), "Asia/Tokyo").size).toBe(
			0,
		);
	});
});
