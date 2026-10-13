import type * as React from "react";
import { cn } from "~/lib/utils";
import { Label } from "./label";

export function Field({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="field"
			className={cn("grid min-w-0 gap-2.5", className)}
			{...props}
		/>
	);
}

export function FieldGroup({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="field-group"
			className={cn("grid min-w-0 gap-6", className)}
			{...props}
		/>
	);
}

export function FieldLabel({
	className,
	...props
}: React.ComponentProps<typeof Label>) {
	return (
		<Label
			data-slot="field-label"
			className={cn("min-h-6", className)}
			{...props}
		/>
	);
}

export function FieldDescription({
	className,
	...props
}: React.ComponentProps<"p">) {
	return (
		<p
			data-slot="field-description"
			className={cn(
				"text-muted-foreground text-sm font-semibold leading-relaxed",
				className,
			)}
			{...props}
		/>
	);
}
