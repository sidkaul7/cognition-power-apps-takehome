const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** `Nov 10, 14:05 UTC`. Rendered on the server in UTC so every machine shows the same value. */
export function formatDateTime(date: Date): string {
  return `${dateTime.format(date)} UTC`;
}

/** Time since `date`, such as `2d 5h` or `45m`. */
export function formatAge(date: Date, now = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}
