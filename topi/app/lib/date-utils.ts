export const HH_MM_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return HH_MM_REGEX.test(value) || value === "";
}

export function formatDueDateForDisplay(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return "";
  const [y, m, d] = dateStr.slice(0, 10).split("-");
  const timePart = dateStr.length >= 19 ? dateStr.slice(11, 16) : null;
  return timePart
    ? `${parseInt(m, 10)}月${parseInt(d, 10)}日 ${timePart}`
    : `${parseInt(m, 10)}月${parseInt(d, 10)}日`;
}
