import type * as React from "react";
import { cn } from "~/lib/utils";

const variants = {
	default: "bg-primary text-primary-foreground",
	secondary: "bg-secondary text-secondary-foreground",
	destructive: "bg-destructive/10 text-destructive",
	outline: "border border-border bg-background text-muted-foreground",
};

export function Badge({
	className,
	variant = "default",
	...props
}: React.ComponentProps<"span"> & { variant?: keyof typeof variants }) {
	return (
		<span
			data-slot="badge"
			className={cn(
				"inline-flex w-fit shrink-0 items-center rounded-md px-2 py-1 text-sm font-bold leading-none",
				variants[variant],
				className,
			)}
			{...props}
		/>
	);
}
