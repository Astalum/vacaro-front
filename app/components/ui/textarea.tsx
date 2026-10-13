import type * as React from "react";
import { cn } from "~/lib/utils";

export function Textarea({
	className,
	...props
}: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"border-input bg-background text-foreground placeholder:text-muted-foreground min-h-36 w-full min-w-0 max-w-full resize-y rounded-xl border px-4 py-3 text-lg font-semibold leading-relaxed shadow-xs outline-none transition-[border-color,box-shadow,background-color] disabled:cursor-not-allowed disabled:opacity-50",
				"focus-visible:border-ring focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring/20",
				"aria-invalid:border-destructive aria-invalid:ring-destructive/20",
				className,
			)}
			{...props}
		/>
	);
}
