export function formatRegisteredDuration(days: number | null | undefined): string | null {
  if (days == null || days < 0) {
    return null;
  }

  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const remainingDays = days - (years * 365) - (months * 30);
  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years}y`);
  }
  if (months > 0) {
    parts.push(`${months}mo`);
  }
  if (remainingDays > 0 || parts.length === 0) {
    parts.push(`${remainingDays}d`);
  }

  return parts.join(' ');
}

export function daysSince(dateString: string | null | undefined): number | null {
  if (!dateString) {
    return null;
  }

  const registrationDate = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(registrationDate.getTime())) {
    return null;
  }

  const now = new Date();
  const diffMs = now.getTime() - registrationDate.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}
