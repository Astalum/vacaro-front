import type { Event, EventStatus } from "./types";

export type EventDisplayStatus = EventStatus | "expired";

export function eventDisplayStatus(
	event: Pick<Event, "status" | "response_deadline_at">,
	now = Date.now(),
): EventDisplayStatus {
	if (event.status !== "open") return event.status;
	if (!event.response_deadline_at) return "open";
	const deadline = Date.parse(event.response_deadline_at);
	return Number.isFinite(deadline) && deadline <= now ? "expired" : "open";
}
