import type { PublicDomain } from '../types';
import ExpirationBar from './ExpirationBar';
import MaskedDomain from './MaskedDomain';
import { formatCurrencyAmount } from '../utils/currency';
import { formatRegisteredDuration } from '../utils/date';

interface DomainTableProps {
  domains: PublicDomain[];
  displayCurrency?: string;
  showActions?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export default function DomainTable({
  domains,
  displayCurrency,
  showActions,
  onEdit,
  onDelete,
}: DomainTableProps) {
  const shouldShowConvertedPrice = (domainCurrency: string) => {
    if (!displayCurrency) {
      return false;
    }

    return displayCurrency.toUpperCase() !== domainCurrency.toUpperCase();
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Domain</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Registrar</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Expiration</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Price</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Tags</th>
            {showActions && (
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Actions</th>
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
                      Registered {domain.registration_date} • {formatRegisteredDuration(domain.registered_days)} ago
                    </div>
                  )}
                </div>
              </td>
              <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                {domain.registrar?.name || '\u2014'}
              </td>
              <td className="py-3 px-4">
                <ExpirationBar
                  remainingDays={domain.remaining_days}
                  renewalDays={domain.renewal_days}
                  status={domain.status}
                />
              </td>
              <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                {domain.renew_price != null ? (
                  <span>
                    {formatCurrencyAmount(domain.renew_price, domain.currency)}
                    {domain.converted_price != null && shouldShowConvertedPrice(domain.currency) && (
                      <span className="text-xs text-gray-400 ml-1">
                        \u2248 {formatCurrencyAmount(
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
                      className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete?.((domain as unknown as { id: string }).id)}
                      className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {domains.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No domains found.
        </div>
      )}
    </div>
  );
}
