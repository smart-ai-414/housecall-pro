export function humanizeEnum(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDateTime(value: Date | string): string {
  return dateTimeFormatter.format(
    typeof value === "string" ? new Date(value) : value,
  );
}

export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");

  return digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;
}

export function formatPhone(input: string): string {
  const digits = normalizePhone(input);
  if (digits.length !== 10) return input;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
