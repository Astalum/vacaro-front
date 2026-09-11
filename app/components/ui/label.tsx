import type * as React from "react";
import { cn } from "~/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: Consumers associate this reusable label through the htmlFor prop.
		<label
			data-slot="label"
			className={cn(
				"text-foreground flex items-center gap-2 text-base font-bold leading-none",
				className,
			)}
			{...props}
		/>
	);
}
