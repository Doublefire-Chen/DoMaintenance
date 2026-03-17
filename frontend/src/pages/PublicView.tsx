import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftEndOnRectangleIcon, ArrowPathIcon, ArrowRightStartOnRectangleIcon, Bars3Icon, ChevronDownIcon, Cog6ToothIcon, UserCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../api/client';
import type { PublicDomainsResponse, User } from '../types';
import DomainTable from '../components/DomainTable';
import CurrencyTotal from '../components/CurrencyTotal';
import { formatCurrencyOption, isSupportedCurrency } from '../utils/currency';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useI18n } from '../i18n';

export default function PublicView() {
  const { t } = useI18n();
  const headerControlClass = 'inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors duration-200';
  const [data, setData] = useState<PublicDomainsResponse | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState('CNY');
  const [loading, setLoading] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  const fetchDomains = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get(`/public/domains?display_currency=${displayCurrency}`)
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

    fetch(`${apiBaseUrl}/auth/me`, {
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

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!mobileMenuRef.current?.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      setIsUserMenuOpen(false);
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex items-start justify-between gap-4 lg:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">DoMaintenance</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('public.subtitle')}</p>
          </div>
            <div className="lg:hidden" ref={mobileMenuRef}>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700 transition-colors duration-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                aria-label="Toggle header menu"
              >
                {isMobileMenuOpen ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
              </button>
              {isMobileMenuOpen && (
                <div className="absolute right-4 z-20 mt-3 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900 sm:right-6">
                  <div className="flex flex-col gap-3">
                    <div className="rounded-lg bg-gray-100 px-3 py-2 dark:bg-gray-800">
                      <LanguageSwitcher compact />
                    </div>
                    {supportedCurrencies.length > 0 && (
                      <select
                        value={displayCurrency}
                        onChange={(e) => {
                          setDisplayCurrency(e.target.value);
                          setIsMobileMenuOpen(false);
                        }}
                        className="h-10 rounded-lg border border-gray-200 bg-gray-100 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      >
                        {supportedCurrencies.map((c) => (
                          <option key={c} value={c}>{formatCurrencyOption(c)}</option>
                        ))}
                      </select>
                    )}
                    {user ? (
                      <>
                        <div className="inline-flex h-10 items-center gap-2 rounded-lg bg-gray-100 px-4 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          <UserCircleIcon className="h-4 w-4" />
                          {user.username}
                        </div>
                        <Link
                          to="/admin"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-indigo-700"
                        >
                          <Cog6ToothIcon className="h-4 w-4" />
                          {t('common.admin')}
                        </Link>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
                          {t('common.signOut')}
                        </button>
                      </>
                    ) : (
                      <Link
                        to="/login"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-indigo-700"
                      >
                        <ArrowLeftEndOnRectangleIcon className="h-4 w-4" />
                        {t('common.login')}
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 hidden flex-wrap items-center gap-3 lg:flex lg:justify-end">
            <div className="flex h-10 items-center rounded-lg bg-gray-100 px-3 dark:bg-gray-800">
              <LanguageSwitcher compact />
            </div>
            {supportedCurrencies.length > 0 && (
              <select
                value={displayCurrency}
                onChange={(e) => setDisplayCurrency(e.target.value)}
                className="h-10 min-w-[8rem] rounded-lg border border-gray-200 bg-gray-100 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                {supportedCurrencies.map((c) => (
                  <option key={c} value={c}>{formatCurrencyOption(c)}</option>
                ))}
              </select>
            )}
            {user ? (
              <>
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen((prev) => !prev)}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-gray-100 px-4 text-sm text-gray-500 transition-colors duration-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    <UserCircleIcon className="h-4 w-4" />
                    <span>{user.username}</span>
                    <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isUserMenuOpen && (
                    <div className="absolute right-0 z-20 mt-2 min-w-40 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition-colors duration-200 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
                        {t('common.signOut')}
                      </button>
                    </div>
                  )}
                </div>
                <Link
                  to="/admin"
                  className={`${headerControlClass} bg-indigo-600 text-white hover:bg-indigo-700`}
                >
                  <Cog6ToothIcon className="h-4 w-4" />
                  {t('common.admin')}
                </Link>
              </>
            ) : (
              <Link
                to="/login"
                className={`${headerControlClass} bg-indigo-600 text-white hover:bg-indigo-700`}
              >
                <ArrowLeftEndOnRectangleIcon className="h-4 w-4" />
                {t('common.login')}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
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
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors duration-200"
            >
              <ArrowPathIcon className="h-4 w-4" />
              {t('common.retry')}
            </button>
          </div>
        ) : data ? (
          <>
            <div className="mb-6 flex justify-stretch sm:justify-end">
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
