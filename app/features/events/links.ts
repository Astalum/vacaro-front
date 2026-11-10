import { apiRequest } from "~/lib/api";
import type { EventWithInvite } from "./types";

export const EVENT_INVITE_URLS_STORAGE_KEY = "vacaro.event-invite-urls";

export const EVENT_INVITE_URL_UPDATED_EVENT = "vacaro:invite-url-updated";

export const RESPONSE_EDIT_URLS_STORAGE_KEY = "vacaro.response-edit-urls";

export function savedResponseEditUrl(eventID: string) {
	try {
		const stored = window.localStorage.getItem(RESPONSE_EDIT_URLS_STORAGE_KEY);
		const urls = stored ? (JSON.parse(stored) as unknown) : null;
		if (
			urls &&
			typeof urls === "object" &&
			eventID in urls &&
			typeof (urls as Record<string, unknown>)[eventID] === "string"
		) {
			return (urls as Record<string, string>)[eventID];
		}
	} catch {
		// The edit URL can be reissued while the current response session is valid.
	}
	return null;
}

export function saveResponseEditUrl(eventID: string, responseEditUrl: string) {
	try {
		const stored = window.localStorage.getItem(RESPONSE_EDIT_URLS_STORAGE_KEY);
		const parsed = stored ? (JSON.parse(stored) as unknown) : null;
		const urls =
			parsed && typeof parsed === "object"
				? (parsed as Record<string, string>)
				: {};
		urls[eventID] = responseEditUrl;
		window.localStorage.setItem(
			RESPONSE_EDIT_URLS_STORAGE_KEY,
			JSON.stringify(urls),
		);
	} catch {
		// The URL remains available in the current action result.
	}
	return responseEditUrl;
}

export function savedEventInviteUrl(eventID: string) {
	try {
		const stored = window.localStorage.getItem(EVENT_INVITE_URLS_STORAGE_KEY);
		const urls = stored ? (JSON.parse(stored) as unknown) : null;
		if (
			urls &&
			typeof urls === "object" &&
			eventID in urls &&
			typeof (urls as Record<string, unknown>)[eventID] === "string"
		) {
			return (urls as Record<string, string>)[eventID];
		}
	} catch {
		// Storage may be unavailable in privacy-focused browser modes.
	}
	return null;
}

export function saveEventInviteUrl(eventID: string, inviteUrl: string) {
	try {
		const stored = window.localStorage.getItem(EVENT_INVITE_URLS_STORAGE_KEY);
		const parsed = stored ? (JSON.parse(stored) as unknown) : null;
		const urls =
			parsed && typeof parsed === "object"
				? (parsed as Record<string, string>)
				: {};
		urls[eventID] = inviteUrl;
		window.localStorage.setItem(
			EVENT_INVITE_URLS_STORAGE_KEY,
			JSON.stringify(urls),
		);
	} catch {
		// The URL remains visible for the current navigation when storage is blocked.
	}
	window.dispatchEvent(
		new CustomEvent(EVENT_INVITE_URL_UPDATED_EVENT, {
			detail: { eventID, inviteUrl },
		}),
	);
	return inviteUrl;
}

export async function reissueEventInviteUrl(eventID: string) {
	const invitedEvent = await apiRequest<EventWithInvite>(
		`/events/${eventID}/invite-token`,
		{ method: "POST" },
	);
	return saveEventInviteUrl(eventID, invitedEvent.invite_url);
}
