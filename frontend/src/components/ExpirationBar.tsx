import { useI18n } from '../i18n';

interface ExpirationBarProps {
  remainingDays: number;
  renewalDays: number;
  status: 'green' | 'yellow' | 'red';
}

export default function ExpirationBar({ remainingDays, renewalDays, status }: ExpirationBarProps) {
  const { t } = useI18n();
  const percentage = Math.max(0, Math.min(100, (remainingDays / renewalDays) * 100));

  const colorClasses = {
    green: 'bg-emerald-500',
    yellow: 'bg-amber-400',
    red: 'bg-red-500',
  };

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClasses[status]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
        {t('expiration.daysShort', { days: remainingDays })}
      </span>
    </div>
  );
}
