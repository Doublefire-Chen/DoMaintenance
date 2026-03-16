import { formatCurrencyAmount } from '../utils/currency';

interface CurrencyTotalProps {
  currency: string;
  total: number | string;
}

export default function CurrencyTotal({ currency, total }: CurrencyTotalProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total ({currency}):</span>
      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {formatCurrencyAmount(total, currency)}
      </span>
    </div>
  );
}
