export function parseGermanDate(dateStr: string): Date {
  if (!dateStr) return new Date('9999-12-31');
  const parts = dateStr.split('.');
  if (parts.length !== 3) return new Date('9999-12-31');
  // Create date at noon to avoid timezone issues
  return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12, 0, 0);
}

export function formatDate(date: Date | string): string {
  if (!date) return '';
  if (typeof date === 'string' && date.match(/^\d{2}\.\d{2}\.\d{4}$/)) return date;
  if (typeof date === 'string') date = new Date(date);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export function convertDateToAPI(dateString: string): string {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function getWeekdayName(date: Date): string {
  const weekdays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  return date instanceof Date && !isNaN(date.getTime()) ? weekdays[date.getDay()] : '';
}

export function getWeekdayAbbreviation(date: Date): string {
  const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return date instanceof Date && !isNaN(date.getTime()) ? weekdays[date.getDay()] : '';
}

export function formatDateWithWeekday(dateString: string, abbreviated: boolean = false): string {
  const date = parseGermanDate(dateString);
  const weekday = abbreviated ? getWeekdayAbbreviation(date) : getWeekdayName(date);
  return `${weekday}, ${dateString}`;
}

export function getTodayString(): string {
  return formatDate(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const date = parseGermanDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}
