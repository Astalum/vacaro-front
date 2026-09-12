import * as PopoverPrimitive from "@radix-ui/react-popover";
import type * as React from "react";
import { cn } from "~/lib/utils";

export function Popover(
	props: React.ComponentProps<typeof PopoverPrimitive.Root>,
) {
	return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

export function PopoverTrigger(
	props: React.ComponentProps<typeof PopoverPrimitive.Trigger>,
) {
	return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

export function PopoverContent({
	className,
	align = "center",
	sideOffset = 6,
	collisionPadding = 12,
	sticky = "always",
	...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Content
				data-slot="popover-content"
				align={align}
				sideOffset={sideOffset}
				collisionPadding={collisionPadding}
				sticky={sticky}
				className={cn(
					"text-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-[100] w-auto max-w-[var(--radix-popover-content-available-width)] origin-[var(--radix-popover-content-transform-origin)] rounded-xl border border-border bg-white p-0 shadow-[0_20px_55px_rgba(23,61,52,0.18)] outline-none",
					className,
				)}
				{...props}
			/>
		</PopoverPrimitive.Portal>
	);
}
