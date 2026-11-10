import { redirect } from "react-router";
import type { Route } from "./+types/calendar-redirect";

export function loader({ params, request }: Route.LoaderArgs) {
	const provider = params.calendarProvider;
	if (
		provider !== undefined &&
		provider !== "icloud" &&
		provider !== "timetree"
	) {
		throw new Response("Not Found", { status: 404 });
	}
	const anchor =
		provider === "timetree" ? "timetree-guide" : "calendar-settings";
	return redirect(`/account${new URL(request.url).search}#${anchor}`, 302);
}
