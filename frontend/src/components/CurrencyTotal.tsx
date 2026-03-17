import { formatCurrencyAmount } from '../utils/currency';
import { useI18n } from '../i18n';

interface CurrencyTotalProps {
  currency: string;
  total: number | string;
}

export default function CurrencyTotal({ currency, total }: CurrencyTotalProps) {
  const { t } = useI18n();

  return (
    <div className="flex w-full flex-col gap-1 rounded-lg bg-gray-50 px-4 py-3 sm:w-auto sm:flex-row sm:items-center sm:gap-2 sm:py-2 dark:bg-gray-800">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('public.total', { currency })}</span>
      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {formatCurrencyAmount(total, currency)}
      </span>
    </div>
  );
}
