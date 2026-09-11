import type * as React from "react";
import { cn } from "~/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"section">) {
	return (
		<section
			data-slot="card"
			className={cn(
				"bg-card text-card-foreground flex flex-col gap-6 rounded-2xl border border-border py-7 shadow-sm",
				className,
			)}
			{...props}
		/>
	);
}

export function CardHeader({
	className,
	...props
}: React.ComponentProps<"header">) {
	return (
		<header
			data-slot="card-header"
			className={cn("grid gap-2 px-7", className)}
			{...props}
		/>
	);
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
	return (
		<h2
			data-slot="card-title"
			className={cn("text-2xl font-extrabold tracking-tight", className)}
			{...props}
		/>
	);
}

export function CardDescription({
	className,
	...props
}: React.ComponentProps<"p">) {
	return (
		<p
			data-slot="card-description"
			className={cn(
				"text-muted-foreground text-base leading-relaxed",
				className,
			)}
			{...props}
		/>
	);
}

export function CardContent({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-content"
			className={cn("px-7", className)}
			{...props}
		/>
	);
}
