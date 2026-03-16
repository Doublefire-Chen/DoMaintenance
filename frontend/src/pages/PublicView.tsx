import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import type { PublicDomainsResponse } from '../types';
import DomainTable from '../components/DomainTable';
import CurrencyTotal from '../components/CurrencyTotal';
import { formatCurrencyOption, isSupportedCurrency } from '../utils/currency';

export default function PublicView() {
  const [data, setData] = useState<PublicDomainsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState('CNY');
  const [loading, setLoading] = useState(true);

  const fetchDomains = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get(`/api/public/domains?display_currency=${displayCurrency}`)
      .then((res) => {
        setData(res.data);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load domains. Please try again later.');
      })
      .finally(() => setLoading(false));
  }, [displayCurrency]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const supportedCurrencies = data?.available_currencies.filter(isSupportedCurrency) ?? [];

  useEffect(() => {
    if (supportedCurrencies.length === 0) {
      return;
    }

    if (!supportedCurrencies.includes(displayCurrency)) {
      setDisplayCurrency(supportedCurrencies[0]);
    }
  }, [displayCurrency, supportedCurrencies]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">DoMaintenance</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Domain Management Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            {supportedCurrencies.length > 0 && (
              <select
                value={displayCurrency}
                onChange={(e) => setDisplayCurrency(e.target.value)}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {supportedCurrencies.map((c) => (
                  <option key={c} value={c}>{formatCurrencyOption(c)}</option>
                ))}
              </select>
            )}
            <Link
              to="/login"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">{error}</p>
            <button
              onClick={fetchDomains}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors duration-200"
            >
              Retry
            </button>
          </div>
        ) : data ? (
          <>
            <div className="flex justify-end mb-6">
              <CurrencyTotal
                currency={data.currency_totals.display_currency}
                total={data.currency_totals.total}
              />
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden">
              <DomainTable
                domains={data.domains}
                displayCurrency={data.currency_totals.display_currency}
              />
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
