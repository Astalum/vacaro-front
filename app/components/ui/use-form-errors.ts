import { useEffect, useState } from "react";

export function useFormErrors(serverErrors?: Record<string, string> | null) {
	const [localErrors, setErrors] = useState<Record<string, string>>({});
	const [cleared, setCleared] = useState<Record<string, boolean>>({});
	const serverErrorKey = JSON.stringify(serverErrors ?? {});
	useEffect(() => {
		// A new server response makes its validation errors visible again.
		void serverErrorKey;
		setCleared({});
	}, [serverErrorKey]);
	const errors = { ...serverErrors, ...localErrors };
	for (const name of Object.keys(cleared)) delete errors[name];
	const clearError = (name: string) => {
		setCleared((current) => ({ ...current, [name]: true }));
		setErrors((current) => {
			const next = { ...current };
			delete next[name];
			return next;
		});
	};
	return {
		errors,
		localErrors,
		setErrors: (next: Record<string, string>) => {
			setCleared({});
			setErrors(next);
		},
		clearError,
		inputProps: (name: string, id: string) => ({
			"aria-invalid": Boolean(errors[name]),
			"aria-describedby": errors[name] ? `${id}-error` : undefined,
		}),
	};
}
