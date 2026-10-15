import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { WeekendText } from "~/components/app";
import { parseDateInput, serializeDateInput } from "~/lib/date-input";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { PickerTrigger } from "./picker-trigger";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type DatePickerProps = {
	id: string;
	name?: string;
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	required?: boolean;
	disabled?: boolean;
	"aria-label"?: string;
	"aria-describedby"?: string;
	"aria-invalid"?: boolean;
	className?: string;
};

export function DatePicker({
	id,
	name,
	value,
	defaultValue,
	onValueChange,
	required = false,
	disabled = false,
	"aria-label": ariaLabel,
	"aria-describedby": ariaDescribedBy,
	"aria-invalid": ariaInvalid,
	className,
}: DatePickerProps) {
	const [open, setOpen] = useState(false);
	const [internalValue, setInternalValue] = useState(defaultValue ?? "");
	const currentValue = value ?? internalValue;
	const selected = parseDateInput(currentValue);
	const updateValue = (date?: Date) => {
		const next = serializeDateInput(date);
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
					icon={CalendarIcon}
					placeholder={!selected}
					disabled={disabled}
					data-required={required || undefined}
					aria-label={ariaLabel}
					aria-describedby={ariaDescribedBy}
					aria-invalid={ariaInvalid}
					className={className}
				>
					{selected ? (
						<WeekendText>
							{format(selected, "yyyy年M月d日(E)", { locale: ja })}
						</WeekendText>
					) : (
						"日付を選択"
					)}
				</PickerTrigger>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				aria-label={ariaLabel ?? "日付を選択"}
				className="picker-popover w-[min(22rem,calc(100vw-1.5rem))]"
				collisionPadding={{ top: 88, right: 12, bottom: 12, left: 12 }}
			>
				<Calendar
					mode="single"
					required={required}
					selected={selected}
					onSelect={(date: Date | undefined) => {
						updateValue(date);
						if (date) setOpen(false);
					}}
					defaultMonth={selected}
					locale={ja}
					fixedWeeks
				/>
				<div className="picker-footer">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => {
							updateValue(new Date());
							setOpen(false);
						}}
					>
						今日
					</Button>
					{!required && selected && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => {
								updateValue(undefined);
								setOpen(false);
							}}
						>
							<XIcon className="size-4" /> 選択をクリア
						</Button>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
