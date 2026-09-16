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

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatRelativeTime(value: Date | string): string {
  const then = value instanceof Date ? value : new Date(value);
  const elapsed = Date.now() - then.getTime();

  if (elapsed < MINUTE_MS) return "just now";
  if (elapsed < HOUR_MS) {
    const minutes = Math.floor(elapsed / MINUTE_MS);
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }
  if (elapsed < DAY_MS) {
    const hours = Math.floor(elapsed / HOUR_MS);
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }

  const days = Math.floor(elapsed / DAY_MS);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;

  return formatDateTime(then);
}
