// Shared, deterministic date formatting for the dashboard.
//
// All dashboard pages are React Server Components, so formatting happens on the
// server and is serialized as text — there is no client/server hydration gap.
// We pin the time zone to UTC so output is stable regardless of the host's
// locale settings, matching the previous `toISOString()`-based helpers these
// functions replace.

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** e.g. "May 29, 2026" */
export function formatDate(date: Date) {
  return dateFormatter.format(date);
}

/** e.g. "May 29, 2026, 13:00" */
export function formatDateTime(date: Date) {
  return dateTimeFormatter.format(date);
}
