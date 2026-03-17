import type { Locale } from '../i18n';
import type { DateTimeDisplayFormat } from '../types';

export function formatRegisteredDuration(
  days: number | null | undefined,
  locale: Locale = 'en',
): string | null {
  if (days == null || days < 0) {
    return null;
  }

  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const remainingDays = days - (years * 365) - (months * 30);
  const parts: string[] = [];

  if (years > 0) {
    parts.push(locale === 'zh-CN' ? `${years}年` : `${years}y`);
  }
  if (months > 0) {
    parts.push(locale === 'zh-CN' ? `${months}个月` : `${months}mo`);
  }
  if (remainingDays > 0 || parts.length === 0) {
    parts.push(locale === 'zh-CN' ? `${remainingDays}天` : `${remainingDays}d`);
  }

  return locale === 'zh-CN' ? parts.join('') : parts.join(' ');
}

export function daysSince(dateString: string | null | undefined): number | null {
  if (!dateString) {
    return null;
  }

  const registrationDate = new Date(dateString);
  if (Number.isNaN(registrationDate.getTime())) {
    return null;
  }

  const now = new Date();
  const diffMs = now.getTime() - registrationDate.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

export function daysUntil(dateString: string | null | undefined): number | null {
  if (!dateString) {
    return null;
  }

  const targetDate = new Date(dateString);
  if (Number.isNaN(targetDate.getTime())) {
    return null;
  }

  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / 86_400_000));
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatUtcOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;

  if (minutes === 0) {
    return `UTC${sign}${hours}`;
  }

  return `UTC${sign}${hours}:${pad(minutes)}`;
}

export function formatDateTime(
  dateString: string | null | undefined,
  format: DateTimeDisplayFormat = 'slash_utc_offset',
): string | null {
  if (!dateString) {
    return null;
  }

  const value = new Date(dateString);
  if (Number.isNaN(value.getTime())) {
    return null;
  }

  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  const hours = pad(value.getHours());
  const minutes = pad(value.getMinutes());
  const offset = formatUtcOffset(value);

  switch (format) {
    case 'iso_utc_offset':
      return `${year}-${month}-${day} ${hours}:${minutes} ${offset}`;
    case 'locale_short':
      return `${new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }).format(value)} ${hours}:${minutes} ${offset}`;
    case 'slash_utc_offset':
    default:
      return `${year}/${month}/${day} ${hours}:${minutes} ${offset}`;
  }
}

export function getDateTimeFormatPreview(
  format: DateTimeDisplayFormat,
  sampleDate: Date = new Date(2026, 0, 1, 22, 0, 0),
): string {
  return formatDateTime(sampleDate.toISOString(), format) || '';
}

export function toDateTimeLocalInputValue(dateString: string | null | undefined): string {
  if (!dateString) {
    return '';
  }

  const value = new Date(dateString);
  if (Number.isNaN(value.getTime())) {
    return '';
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function fromDateTimeLocalInputValue(dateString: string): string | null {
  if (!dateString) {
    return null;
  }

  const value = new Date(dateString);
  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return value.toISOString();
}
