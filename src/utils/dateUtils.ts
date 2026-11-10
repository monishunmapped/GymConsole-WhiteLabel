const DAY_MS = 86_400_000;

const valid = (d: Date) => !isNaN(d.getTime()) && d.getFullYear() >= 1900 && d.getFullYear() <= 2100;
const century = (yy: number) => (yy > 30 ? 1900 : 2000) + yy;

const build = (day: number, month: number, year: number) =>
  day >= 1 && day <= 31 && month >= 1 && month <= 12 ? new Date(year, month - 1, day) : null;

export function parseDate(input: string | Date | number | null | undefined): Date {
  if (input instanceof Date) return valid(input) ? input : new Date();
  const str = String(input ?? '').trim();
  if (!str) return new Date();

  if (/^\d{10,13}$/.test(str)) {
    const d = new Date(Number(str));
    if (valid(d)) return d;
  }

  let m: RegExpMatchArray | null;
  let d: Date | null = null;
  if ((m = str.match(/^(\d{2})(\d{2})(\d{4})$/))) d = build(+m[1], +m[2], +m[3]);
  else if ((m = str.match(/^(\d{2})(\d{2})(\d{2})$/))) d = build(+m[1], +m[2], century(+m[3]));
  else if ((m = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) d = build(+m[1], +m[2], +m[3]);
  else if ((m = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/))) d = build(+m[1], +m[2], century(+m[3]));
  else if ((m = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) d = build(+m[3], +m[2], +m[1]);
  if (d) return d;

  const parsed = new Date(str);
  return valid(parsed) ? parsed : new Date();
}

export function formatDateISO(dateInput: string | Date | null | undefined): string {
  const d = parseDate(dateInput);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const todayISO = () => formatDateISO(new Date());

export function formatDateDDMMYYYY(dateInput: string | Date | null | undefined, separator = '-'): string {
  const [y, m, d] = formatDateISO(dateInput).split('-');
  return [d, m, y].join(separator);
}

export function calculateExpiryDate(joinDateInput: string | Date, durationDays: number) {
  const end = new Date(parseDate(joinDateInput));
  end.setDate(end.getDate() + durationDays);
  return { expiryObj: end, expiryDateIso: formatDateISO(end), expiryDateFormatted: formatDateDDMMYYYY(end) };
}

export function calculateDaysRemaining(expiryDateInput: string | Date, referenceDateInput: string | Date = new Date()): number {
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.max(0, Math.ceil((day(parseDate(expiryDateInput)) - day(parseDate(referenceDateInput))) / DAY_MS));
}
