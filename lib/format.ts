const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatMonth(month: number): string {
  return MONTH_NAMES[month - 1] ?? String(month);
}

export function formatSessionLabel(
  year: number,
  month: number,
  label?: string,
): string {
  const base = `${formatMonth(month)} ${year}`;
  return label ? `${label} (${base})` : base;
}

export function sessionKey(year: number, month: number): string {
  return `${year}-${month}`;
}
