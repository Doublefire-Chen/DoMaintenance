import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import type { PublicDomainsResponse, User } from '../types';
import DomainTable from '../components/DomainTable';
import CurrencyTotal from '../components/CurrencyTotal';
import { formatCurrencyOption, isSupportedCurrency } from '../utils/currency';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useI18n } from '../i18n';

export default function PublicView() {
  const { t } = useI18n();
  const [data, setData] = useState<PublicDomainsResponse | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState('CNY');
  const [loading, setLoading] = useState(true);
  const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

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
        setError(t('public.loadError'));
      })
      .finally(() => setLoading(false));
  }, [displayCurrency, t]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${apiBaseUrl}/api/auth/me`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          setUser(null);
          return;
        }

        const payload = await response.json() as User;
        setUser(payload);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setUser(null);
        }
      });

    return () => controller.abort();
  }, [apiBaseUrl]);

  const supportedCurrencies = data?.available_currencies.filter(isSupportedCurrency) ?? [];

  useEffect(() => {
    if (supportedCurrencies.length === 0) {
      return;
    }

    if (!supportedCurrencies.includes(displayCurrency)) {
      setDisplayCurrency(supportedCurrencies[0]);
    }
  }, [displayCurrency, supportedCurrencies]);

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      setUser(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">DoMaintenance</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('public.subtitle')}</p>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
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
            {user ? (
              <>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {user.username}
                </span>
                <Link
                  to="/admin"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
                >
                  {t('common.admin')}
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors duration-200"
                >
                  {t('common.signOut')}
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
              >
                {t('common.login')}
              </Link>
            )}
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
              {t('common.retry')}
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
                dateTimeFormat={data.date_time_display_format}
              />
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
