import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { DateTimeDisplayFormat, PublicDomain } from '../types';
import ExpirationBar from './ExpirationBar';
import MaskedDomain from './MaskedDomain';
import { formatCurrencyAmount } from '../utils/currency';
import { formatDateTime, formatRegisteredDuration } from '../utils/date';
import { useI18n } from '../i18n';

interface DomainTableProps {
  domains: PublicDomain[];
  displayCurrency?: string;
  dateTimeFormat?: DateTimeDisplayFormat;
  showActions?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export default function DomainTable({
  domains,
  displayCurrency,
  dateTimeFormat = 'slash_utc_offset',
  showActions,
  onEdit,
  onDelete,
}: DomainTableProps) {
  const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const { locale, t } = useI18n();
  const actionButtonClass = 'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-200';
  const shouldShowConvertedPrice = (domainCurrency: string) => {
    if (!displayCurrency) {
      return false;
    }

    return displayCurrency.toUpperCase() !== domainCurrency.toUpperCase();
  };

  return (
    <>
      <div className="space-y-3 md:hidden">
        {domains.map((domain, index) => (
          <div
            key={index}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <MaskedDomain name={domain.name} />
                {domain.registration_date && domain.registered_days != null && (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('public.registeredAt', {
                      date: formatDateTime(domain.registration_date, dateTimeFormat) || '',
                      duration: formatRegisteredDuration(domain.registered_days, locale) || '',
                    })}
                  </div>
                )}
              </div>
              {showActions && (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => onEdit?.((domain as unknown as { id: string }).id)}
                    title={t('common.edit')}
                    aria-label={t('common.edit')}
                    className={`${actionButtonClass} text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-300`}
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete?.((domain as unknown as { id: string }).id)}
                    title={t('common.delete')}
                    aria-label={t('common.delete')}
                    className={`${actionButtonClass} text-red-600 hover:bg-red-50 hover:text-red-800 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300`}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t('common.registrar')}
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  {domain.registrar ? (
                    <div className="flex items-center gap-2">
                      {domain.favicon_url ? (
                        <img
                          src={`${apiBaseUrl}${domain.favicon_url}`}
                          alt=""
                          className="h-5 w-5 rounded"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="h-5 w-5 rounded bg-gray-100 dark:bg-gray-800" />
                      )}
                      <span>{domain.registrar.name}</span>
                    </div>
                  ) : '\u2014'}
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t('domains.expires')}
                </div>
                <ExpirationBar
                  remainingDays={domain.remaining_days}
                  renewalDays={domain.renewal_days}
                  status={domain.status}
                />
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('public.expiresAt', {
                    date: formatDateTime(domain.expiration_date, dateTimeFormat) || domain.expiration_date,
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t('common.price')}
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  {domain.renew_price != null ? (
                    <span>
                      {formatCurrencyAmount(domain.renew_price, domain.currency)}
                      {domain.converted_price != null && shouldShowConvertedPrice(domain.currency) && (
                        <span className="ml-1 text-xs text-gray-400">
                          &asymp; {formatCurrencyAmount(
                            domain.converted_price,
                            displayCurrency || domain.currency,
                          )}
                        </span>
                      )}
                    </span>
                  ) : '\u2014'}
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t('common.tags')}
                </div>
                <div className="flex flex-wrap gap-1">
                  {domain.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="px-2 py-0.5 text-xs rounded-full font-medium"
                      style={{
                        backgroundColor: tag.color ? `${tag.color}20` : '#e5e7eb',
                        color: tag.color || '#6b7280',
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.domain')}</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.registrar')}</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('domains.expires')}</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.price')}</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.tags')}</th>
            {showActions && (
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.actions')}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {domains.map((domain, index) => (
            <tr
              key={index}
              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200"
            >
              <td className="py-3 px-4">
                <div>
                  <MaskedDomain name={domain.name} />
                  {domain.registration_date && domain.registered_days != null && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t('public.registeredAt', {
                        date: formatDateTime(domain.registration_date, dateTimeFormat) || '',
                        duration: formatRegisteredDuration(domain.registered_days, locale) || '',
                      })}
                    </div>
                  )}
                </div>
              </td>
              <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                {domain.registrar ? (
                  <div className="flex items-center gap-2">
                    {domain.favicon_url ? (
                      <img
                        src={`${apiBaseUrl}${domain.favicon_url}`}
                        alt=""
                        className="h-5 w-5 rounded"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="h-5 w-5 rounded bg-gray-100 dark:bg-gray-800" />
                    )}
                    <span>{domain.registrar.name}</span>
                  </div>
                ) : '\u2014'}
              </td>
              <td className="py-3 px-4">
                <div>
                  <ExpirationBar
                    remainingDays={domain.remaining_days}
                    renewalDays={domain.renewal_days}
                    status={domain.status}
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('public.expiresAt', {
                      date: formatDateTime(domain.expiration_date, dateTimeFormat) || domain.expiration_date,
                    })}
                  </div>
                </div>
              </td>
              <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                {domain.renew_price != null ? (
                  <span>
                    {formatCurrencyAmount(domain.renew_price, domain.currency)}
                    {domain.converted_price != null && shouldShowConvertedPrice(domain.currency) && (
                      <span className="text-xs text-gray-400 ml-1">
                        &asymp; {formatCurrencyAmount(
                          domain.converted_price,
                          displayCurrency || domain.currency,
                        )}
                      </span>
                    )}
                  </span>
                ) : '\u2014'}
              </td>
              <td className="py-3 px-4">
                <div className="flex flex-wrap gap-1">
                  {domain.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="px-2 py-0.5 text-xs rounded-full font-medium"
                      style={{
                        backgroundColor: tag.color ? `${tag.color}20` : '#e5e7eb',
                        color: tag.color || '#6b7280',
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </td>
              {showActions && (
                <td className="py-3 px-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onEdit?.((domain as unknown as { id: string }).id)}
                      title={t('common.edit')}
                      aria-label={t('common.edit')}
                      className={`${actionButtonClass} text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-300`}
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete?.((domain as unknown as { id: string }).id)}
                      title={t('common.delete')}
                      aria-label={t('common.delete')}
                      className={`${actionButtonClass} text-red-600 hover:bg-red-50 hover:text-red-800 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300`}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {domains.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {t('public.noDomains')}
        </div>
      )}
    </>
  );
}
