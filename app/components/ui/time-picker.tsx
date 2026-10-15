import { CheckIcon, Clock3Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isTimeValue } from "~/lib/time";
import { cn } from "~/lib/utils";
import { Button } from "./button";
import { PickerTrigger } from "./picker-trigger";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type TimePickerProps = {
	id: string;
	name?: string;
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	min?: string;
	max?: string;
	required?: boolean;
	disabled?: boolean;
	allowEndOfDay?: boolean;
	"aria-label"?: string;
	"aria-describedby"?: string;
	"aria-invalid"?: boolean;
	className?: string;
};

type TimePickerPanelProps = {
	value: string;
	onValueChange: (value: string) => void;
	min?: string;
	max?: string;
	allowEndOfDay?: boolean;
};

const pad = (value: number) => String(value).padStart(2, "0");

function isAvailable(value: string, min?: string, max?: string) {
	return (!min || value >= min) && (!max || value <= max);
}

function TimeColumn({
	label,
	items,
	value,
	onSelect,
	isDisabled,
}: {
	label: string;
	items: string[];
	value: string;
	onSelect: (value: string) => void;
	isDisabled: (value: string) => boolean;
}) {
	const listRef = useRef<HTMLDivElement>(null);
	const selectedRef = useRef<HTMLButtonElement>(null);
	const firstAvailable = items.find((item) => !isDisabled(item));
	const focusValue = isDisabled(value) ? firstAvailable : value;

	useEffect(() => {
		// Re-center the selected option whenever the controlled value changes.
		void focusValue;
		const list = listRef.current;
		const selected = selectedRef.current;
		if (list && selected) {
			// Scroll only this column; do not move the form behind the popover.
			list.scrollTop =
				selected.offsetTop -
				list.offsetTop -
				(list.clientHeight - selected.clientHeight) / 2;
		}
	}, [focusValue]);

	return (
		<div className="time-picker-column">
			<span className="time-picker-column-label" aria-hidden="true">
				{label}
			</span>
			<div
				ref={listRef}
				role="listbox"
				aria-label={label}
				className="time-picker-list"
				onKeyDown={(event) => {
					const options = Array.from(
						event.currentTarget.querySelectorAll<HTMLButtonElement>(
							"button:not(:disabled)",
						),
					);
					const current = options.indexOf(event.target as HTMLButtonElement);
					let next: number;
					if (event.key === "ArrowDown")
						next = Math.min(current + 1, options.length - 1);
					else if (event.key === "ArrowUp") next = Math.max(current - 1, 0);
					else if (event.key === "Home") next = 0;
					else if (event.key === "End") next = options.length - 1;
					else return;
					event.preventDefault();
					options[next]?.focus();
					if (options[next]) onSelect(options[next].value);
				}}
			>
				{items.map((item) => (
					<button
						key={item}
						ref={item === value ? selectedRef : undefined}
						type="button"
						role="option"
						value={item}
						aria-selected={item === value}
						tabIndex={item === focusValue ? 0 : -1}
						disabled={isDisabled(item)}
						onClick={() => onSelect(item)}
						className="time-picker-option"
					>
						{item}
						{item === value && <CheckIcon size={14} aria-hidden="true" />}
					</button>
				))}
			</div>
		</div>
	);
}

export function TimePickerPanel({
	value,
	onValueChange,
	min,
	max,
	allowEndOfDay = false,
}: TimePickerPanelProps) {
	const current =
		isTimeValue(value) || (allowEndOfDay && value === "24:00")
			? value
			: (min ?? "09:00");
	const [hour, minute] = current.split(":");
	const hours = Array.from({ length: allowEndOfDay ? 25 : 24 }, (_, index) =>
		pad(index),
	);
	const minutes = Array.from({ length: 60 }, (_, index) => pad(index));
	const hourDisabled = (item: string) =>
		Boolean(
			(min && `${item}:${item === "24" ? "00" : "59"}` < min) ||
				(max && `${item}:00` > max),
		);
	const minuteDisabled = (item: string) =>
		(hour === "24" && item !== "00") ||
		!isAvailable(`${hour}:${item}`, min, max);
	const selectHour = (nextHour: string) => {
		let next = `${nextHour}:${nextHour === "24" ? "00" : minute}`;
		if (min && next < min) next = min;
		if (max && next > max) next = max;
		if (isAvailable(next, min, max)) onValueChange(next);
	};
	const selectMinute = (nextMinute: string) => {
		if (!minuteDisabled(nextMinute)) onValueChange(`${hour}:${nextMinute}`);
	};

	return (
		<div className="time-picker-panel">
			<div className="time-picker-preview">
				<span>
					<Clock3Icon size={16} aria-hidden="true" /> 選択中の時刻
				</span>
				<strong aria-live="polite">{current}</strong>
			</div>
			<div className="time-picker-columns">
				<TimeColumn
					label="時"
					items={hours}
					value={hour}
					onSelect={selectHour}
					isDisabled={hourDisabled}
				/>
				<span className="time-picker-separator" aria-hidden="true">
					:
				</span>
				<TimeColumn
					label="分"
					items={minutes}
					value={minute}
					onSelect={selectMinute}
					isDisabled={minuteDisabled}
				/>
			</div>
			<fieldset className="time-picker-shortcuts" aria-label="よく使う分">
				{["00", "15", "30", "45"].map((item) => (
					<button
						key={item}
						type="button"
						aria-pressed={minute === item}
						disabled={minuteDisabled(item)}
						onClick={() => selectMinute(item)}
					>
						{item}分
					</button>
				))}
			</fieldset>
		</div>
	);
}

export function TimePicker({
	id,
	name,
	value,
	defaultValue = "09:00",
	onValueChange,
	min,
	max,
	required = false,
	disabled = false,
	allowEndOfDay = false,
	"aria-label": ariaLabel,
	"aria-describedby": ariaDescribedBy,
	"aria-invalid": ariaInvalid,
	className,
}: TimePickerProps) {
	const [open, setOpen] = useState(false);
	const [internalValue, setInternalValue] = useState(defaultValue);
	const currentValue = value ?? internalValue;
	const updateValue = (next: string) => {
		if (value === undefined) setInternalValue(next);
		onValueChange?.(next);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			{name && (
				<input
					type="hidden"
					name={name}
					value={currentValue}
					disabled={disabled}
				/>
			)}
			<PopoverTrigger asChild>
				<PickerTrigger
					id={id}
					icon={Clock3Icon}
					disabled={disabled}
					placeholder={!currentValue}
					data-required={required || undefined}
					aria-label={ariaLabel ? `${ariaLabel} ${currentValue}` : undefined}
					aria-describedby={ariaDescribedBy}
					aria-invalid={ariaInvalid}
					className={cn("w-full min-w-0 max-w-full", className)}
				>
					{currentValue || "時刻を選択"}
				</PickerTrigger>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				aria-label={ariaLabel ?? "時刻を選択"}
				className="picker-popover w-[min(20rem,calc(100vw-1.5rem))]"
				collisionPadding={{ top: 88, right: 12, bottom: 12, left: 12 }}
			>
				<TimePickerPanel
					value={currentValue}
					onValueChange={updateValue}
					min={min}
					max={max}
					allowEndOfDay={allowEndOfDay}
				/>
				<div className="picker-footer">
					<Button
						type="button"
						size="sm"
						className="w-full"
						onClick={() => {
							if (!currentValue) updateValue(min ?? "09:00");
							setOpen(false);
						}}
					>
						この時刻にする
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
