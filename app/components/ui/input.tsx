import type * as React from "react";
import { cn } from "~/lib/utils";

export function Input({
	className,
	type,
	...props
}: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"border-input bg-background text-foreground placeholder:text-muted-foreground h-14 w-full min-w-0 max-w-full rounded-xl border px-4 py-2 text-lg font-semibold shadow-xs outline-none transition-[border-color,box-shadow,background-color] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
				"focus-visible:border-ring focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring/20",
				"aria-invalid:border-destructive aria-invalid:ring-destructive/20",
				className,
			)}
			{...props}
		/>
	);
}
