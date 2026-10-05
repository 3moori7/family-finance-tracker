import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const control =
  "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink placeholder:text-ink-soft/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
      {hint && !error && <span className="text-xs font-normal text-ink-soft">{hint}</span>}
      {error && (
        <span role="alert" className="text-xs font-normal text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${control} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...props} className={`${control} py-2 ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${control} ${props.className ?? ""}`} />;
}

/**
 * Money field. The visible value is a plain decimal in SAR; the server parses it with
 * parseAmountInput so the browser never does money arithmetic.
 */
export function AmountInput({
  name = "amount",
  defaultValue,
  allowNegative,
  autoFocus,
  required = true,
  className = "",
  onValueChange,
}: {
  name?: string;
  defaultValue?: string;
  allowNegative?: boolean;
  autoFocus?: boolean;
  required?: boolean;
  className?: string;
  onValueChange?: (value: string) => void;
}) {
  return (
    <input
      name={name}
      type="text"
      inputMode={allowNegative ? "text" : "decimal"}
      pattern={allowNegative ? "-?[0-9.,٠-٩٫]*" : "[0-9.,٠-٩٫]*"}
      defaultValue={defaultValue}
      required={required}
      autoFocus={autoFocus}
      onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
      autoComplete="off"
      dir="ltr"
      placeholder="0.00"
      className={`${control} num text-lg font-semibold ${className}`}
    />
  );
}
