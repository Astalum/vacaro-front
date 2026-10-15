import { ja } from "date-fns/locale";
import {
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronUpIcon,
} from "lucide-react";
import type * as React from "react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { cn } from "~/lib/utils";

export function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	modifiers,
	modifiersClassNames,
	...props
}: React.ComponentProps<typeof DayPicker>) {
	const defaultClassNames = getDefaultClassNames();

	return (
		<DayPicker
			locale={ja}
			showOutsideDays={showOutsideDays}
			className={cn("vacaro-calendar", className)}
			modifiers={{
				sunday: { dayOfWeek: [0] },
				saturday: { dayOfWeek: [6] },
				...modifiers,
			}}
			modifiersClassNames={{
				sunday: "weekday-sunday",
				saturday: "weekday-saturday",
				...modifiersClassNames,
			}}
			classNames={{
				root: defaultClassNames.root,
				months: "vacaro-calendar-months",
				month: "vacaro-calendar-month",
				month_caption: "vacaro-calendar-caption",
				caption_label: "vacaro-calendar-caption-label",
				nav: "vacaro-calendar-nav",
				button_previous: "vacaro-calendar-nav-button",
				button_next: "vacaro-calendar-nav-button",
				month_grid: "vacaro-calendar-grid",
				weekdays: "calendar-weekdays",
				weekday: "calendar-weekday",
				week: "vacaro-calendar-week",
				day: "vacaro-calendar-day",
				day_button: "vacaro-calendar-day-button",
				today: "vacaro-calendar-today",
				outside: "vacaro-calendar-outside",
				disabled: "vacaro-calendar-disabled",
				hidden: "invisible",
				selected: "vacaro-calendar-selected",
				range_start: "vacaro-calendar-range-start",
				range_middle: "vacaro-calendar-range-middle",
				range_end: "vacaro-calendar-range-end",
				...classNames,
			}}
			components={{
				Chevron: ({ className: iconClassName, orientation }) => {
					const Icon =
						orientation === "left"
							? ChevronLeftIcon
							: orientation === "right"
								? ChevronRightIcon
								: orientation === "up"
									? ChevronUpIcon
									: ChevronDownIcon;
					return <Icon className={cn("size-4", iconClassName)} />;
				},
				...props.components,
			}}
			{...props}
		/>
	);
}
