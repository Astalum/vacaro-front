import type { ParticipantAvailability } from "./api";

export type AvailabilitySegment = {
	start_at: string;
	end_at: string;
	available_participant_ids: string[];
};

export type AvailabilityRange = {
	start_at: string;
	end_at: string;
	available_participant_count: number;
	total_participant_count: number;
	segments: AvailabilitySegment[];
};

// Summarize actual answers, rather than duration-sized candidate windows.
// Keep membership changes inside one count range so the detail stays accurate.
export function summarizeAvailability(
	availability: ParticipantAvailability[],
	windowStart: string,
	windowEnd: string,
	timeZone: string,
) {
	const start = Date.parse(windowStart);
	const end = Date.parse(windowEnd);
	const rangesByDate = new Map<string, AvailabilityRange[]>();
	if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end)
		return rangesByDate;
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	const dateKey = (instant: number) => {
		const parts = formatter.formatToParts(new Date(instant));
		return ["year", "month", "day"]
			.map((type) => parts.find((part) => part.type === type)?.value)
			.join("-");
	};
	const changes = new Map<number, Map<string, number>>();
	const addChange = (instant: number, id: string, delta: number) => {
		const entries = changes.get(instant) ?? new Map<string, number>();
		entries.set(id, (entries.get(id) ?? 0) + delta);
		changes.set(instant, entries);
	};
	for (const { participant, intervals } of availability) {
		if (participant.response_status !== "submitted") continue;
		for (const interval of intervals) {
			const from = Math.max(start, Date.parse(interval.start_at));
			const to = Math.min(end, Date.parse(interval.end_at));
			if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to)
				continue;
			addChange(from, participant.id, 1);
			addChange(to, participant.id, -1);
		}
	}
	const times = [...changes.keys()].sort((left, right) => left - right);
	const active = new Map<string, number>();
	const total = new Set(availability.map(({ participant }) => participant.id))
		.size;
	for (let index = 0; index + 1 < times.length; index++) {
		const instant = times[index];
		for (const [id, delta] of changes.get(instant) ?? []) {
			const count = (active.get(id) ?? 0) + delta;
			if (count > 0) active.set(id, count);
			else active.delete(id);
		}
		if (!active.size) continue;
		const ids = [...active.keys()].sort();
		const until = times[index + 1];
		let from = instant;
		while (from < until) {
			const key = dateKey(from);
			let to = until;
			if (dateKey(until - 1) !== key) {
				// Find local midnight without assuming a 24-hour day (DST).
				let low = from + 1;
				let high = until;
				while (low < high) {
					const middle = Math.floor((low + high) / 2);
					if (dateKey(middle) === key) low = middle + 1;
					else high = middle;
				}
				to = low;
			}
			const startAt = new Date(from).toISOString();
			const endAt = new Date(to).toISOString();
			const ranges = rangesByDate.get(key) ?? [];
			const previous = ranges.at(-1);
			if (
				previous?.end_at === startAt &&
				previous.available_participant_count === ids.length
			) {
				previous.end_at = endAt;
				const segment = previous.segments.at(-1);
				if (segment?.available_participant_ids.join("\0") === ids.join("\0"))
					segment.end_at = endAt;
				else
					previous.segments.push({
						start_at: startAt,
						end_at: endAt,
						available_participant_ids: ids,
					});
			} else {
				ranges.push({
					start_at: startAt,
					end_at: endAt,
					available_participant_count: ids.length,
					total_participant_count: total,
					segments: [
						{
							start_at: startAt,
							end_at: endAt,
							available_participant_ids: ids,
						},
					],
				});
			}
			rangesByDate.set(key, ranges);
			from = to;
		}
	}
	return rangesByDate;
}
