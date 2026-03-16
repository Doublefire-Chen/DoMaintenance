import { useEffect, useState } from 'react';
import api from '../../api/client';
import { formatCurrencyOption, isSupportedCurrency, normalizeCurrencyCode } from '../../utils/currency';

interface CurrencyRate {
  code: string;
  rate: string | number;
}

interface CurrencyStatus {
  fetched_at: string;
  currencies: CurrencyRate[];
}

function formatRate(rate: string | number): string {
  const parsed = typeof rate === 'number' ? rate : Number.parseFloat(rate);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
}

export default function Currencies() {
  const [data, setData] = useState<CurrencyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrencies = () => {
    setLoading(true);
    setError(null);

    api.get('/api/admin/currencies')
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error(err);
        setError('Failed to load currency status.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCurrencies();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Currencies</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Inspect the cached currency rates and the last successful fetch time.
          </p>
        </div>
        <button
          onClick={fetchCurrencies}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {error}
        </div>
      ) : data ? (
        <>
          {(() => {
            const supportedCurrencies = data.currencies.filter((currency) =>
              isSupportedCurrency(currency.code) && normalizeCurrencyCode(currency.code) !== 'USD',
            );

            return (
              <>
          <div className="mb-4 px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400">Last fetched</p>
            <p className="text-base font-medium text-gray-900 dark:text-gray-100 mt-1">
              {new Date(data.fetched_at).toLocaleString()}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Currency</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Label</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Rate vs 🇺🇸 $ (USD)</th>
                </tr>
              </thead>
              <tbody>
                {supportedCurrencies.map((currency) => (
                  <tr
                    key={currency.code}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-3 px-4 font-mono text-sm text-gray-900 dark:text-gray-100">
                      {normalizeCurrencyCode(currency.code)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {formatCurrencyOption(currency.code)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {`1 🇺🇸 $ (USD) = ${formatRate(currency.rate)} ${formatCurrencyOption(currency.code)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
              </>
            );
          })()}
        </>
      ) : null}
    </div>
  );
}
