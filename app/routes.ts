import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("privacy", "routes/privacy.tsx"),
	route("terms", "routes/terms.tsx"),
	route("account", "routes/account.tsx"),
	route("events", "routes/events/index.tsx"),
	route("events/new", "routes/events/new.tsx"),
	route("events/:eventId/created", "routes/events/created.tsx"),
	route("events/:eventId/availability", "routes/events/availability.tsx"),
	route("events/:eventId/results", "routes/events/results.tsx"),
	route("events/:eventId/manage", "routes/events/manage.tsx"),
	route("events/:eventId/edit", "routes/events/edit.tsx"),
	route("events/:eventId/confirmed", "routes/events/confirmed.tsx"),
	route("invitations/:inviteToken", "routes/invitations/join.tsx"),
	route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
