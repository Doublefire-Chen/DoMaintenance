import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bars3Icon, PlusIcon } from '@heroicons/react/24/outline';
import api from '../../api/client';
import type { DateTimeDisplayFormat, Domain } from '../../types';
import { formatCurrencyAmount } from '../../utils/currency';
import { daysSince, daysUntil, formatDateTime, formatRegisteredDuration } from '../../utils/date';
import { useI18n } from '../../i18n';

export default function DomainList() {
  const { t } = useI18n();
  const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [dateTimeFormat, setDateTimeFormat] = useState<DateTimeDisplayFormat>('slash_utc_offset');
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingWhois, setRefreshingWhois] = useState(false);
  const [refreshingDomainIds, setRefreshingDomainIds] = useState<string[]>([]);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [draggingDomainId, setDraggingDomainId] = useState<string | null>(null);
  const [reorderDraft, setReorderDraft] = useState<Domain[] | null>(null);
  const [savingReorder, setSavingReorder] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const displayedDomains = reorderDraft ?? domains;

  const fetchDomains = async () => {
    setLoading(true);
    return api.get('/api/admin/domains')
      .then((res) => {
        setDomains(res.data);
        setSelectedDomainIds((prev) =>
          prev.filter((id) => res.data.some((domain: Domain) => domain.id === id)),
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDomains();
    api.get('/api/admin/settings')
      .then((res) => setDateTimeFormat(res.data.date_time_display_format || 'slash_utc_offset'))
      .catch(console.error);
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(t('domains.deleteConfirm'))) return;
    try {
      await api.delete(`/api/admin/domains/${id}`);
      fetchDomains();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefreshWhois = async () => {
    setRefreshingWhois(true);
    setRefreshMessage(null);

    try {
      const payload = selectedDomainIds.length > 0
        ? { domain_ids: selectedDomainIds }
        : {};
      const res = await api.post('/api/admin/domains/refresh-whois', payload);
      const summary = res.data as {
        total_domains: number;
        updated: number;
        failed: number;
      };

      fetchDomains();
      if (selectedDomainIds.length > 0) {
        setSelectedDomainIds([]);
      }
      setRefreshMessage(
        t('domains.refreshSummary', {
          updated: summary.updated,
          total: summary.total_domains,
          failedSuffix: summary.failed > 0 ? t('domains.failedSuffix', { count: summary.failed }) : '',
        }),
      );
    } catch (err) {
      console.error(err);
      setRefreshMessage(t('domains.refreshFail'));
    } finally {
      setRefreshingWhois(false);
    }
  };

  const handleRefreshDomain = async (id: string, domainName: string) => {
    setRefreshingDomainIds((prev) => [...prev, id]);
    setRefreshMessage(null);

    try {
      const res = await api.post('/api/admin/domains/refresh-whois', {
        domain_ids: [id],
      });
      const summary = res.data as {
        total_domains: number;
        updated: number;
        failed: number;
      };

      fetchDomains();
      setSelectedDomainIds((prev) => prev.filter((domainId) => domainId !== id));
      setRefreshMessage(
        t('domains.refreshRowSummary', {
          name: domainName,
          updated: summary.updated,
          failedSuffix: summary.failed > 0 ? t('domains.failedSuffix', { count: summary.failed }) : '',
        }),
      );
    } catch (err) {
      console.error(err);
      setRefreshMessage(t('domains.refreshRowFail', { name: domainName }));
    } finally {
      setRefreshingDomainIds((prev) => prev.filter((domainId) => domainId !== id));
    }
  };

  const handleReorder = async (fromId: string, toId: string) => {
    if (fromId === toId) {
      return;
    }

    const reorderedDomains = reorderDraft ?? domains;
    const fromIndex = reorderedDomains.findIndex((domain) => domain.id === fromId);
    const toIndex = reorderedDomains.findIndex((domain) => domain.id === toId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return;
    }

    setSavingReorder(true);
    setRefreshMessage(null);

    const persistedOrder = reorderedDomains.map((domain) => domain.id);

    try {
      await api.post('/api/admin/domains/reorder', {
        domain_ids: persistedOrder,
      });
      await fetchDomains();
      setRefreshMessage(t('domains.orderUpdated'));
    } catch (err) {
      console.error(err);
      await fetchDomains();
      setRefreshMessage(t('domains.orderUpdateFailed'));
    } finally {
      setSavingReorder(false);
      setDraggingDomainId(null);
      setReorderDraft(null);
    }
  };

  const previewReorder = (fromId: string, toId: string) => {
    setReorderDraft((prev) => {
      const base = prev ?? domains;
      const fromIndex = base.findIndex((domain) => domain.id === fromId);
      const toIndex = base.findIndex((domain) => domain.id === toId);

      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return base;
      }

      const next = [...base];
      const [movedDomain] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, movedDomain);

      return next.map((domain, index) => ({
        ...domain,
        display_order: index,
      }));
    });
  };

  const toggleDomainSelection = (id: string) => {
    setSelectedDomainIds((prev) => (
      prev.includes(id)
        ? prev.filter((domainId) => domainId !== id)
        : [...prev, id]
    ));
  };

  const toggleSelectAll = () => {
    if (selectedDomainIds.length === displayedDomains.length) {
      setSelectedDomainIds([]);
      return;
    }

    setSelectedDomainIds(displayedDomains.map((domain) => domain.id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('domains.title')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('domains.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsReorderMode((prev) => {
                const next = !prev;
                if (!next) {
                  setReorderDraft(null);
                }
                return next;
              });
              setDraggingDomainId(null);
            }}
            disabled={savingReorder}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 ${
              isReorderMode
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {isReorderMode ? t('domains.doneEditingOrder') : t('domains.editOrder')}
          </button>
          <button
            onClick={handleRefreshWhois}
            disabled={refreshingWhois || isReorderMode}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200 disabled:opacity-50"
          >
            {refreshingWhois
              ? t('domains.refreshing')
              : selectedDomainIds.length > 0
                ? t('domains.refreshSelected', { count: selectedDomainIds.length })
                : t('domains.refreshAllDates')}
          </button>
          <Link
            to="/admin/domains/new"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
          >
            <PlusIcon className="h-4 w-4" />
            {t('domains.addDomain')}
          </Link>
        </div>
      </div>

      {refreshMessage && (
        <div className="mb-4 px-4 py-3 bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 rounded-lg">
          {refreshMessage}
        </div>
      )}

      {isReorderMode && (
        <div className="mb-4 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-sm text-indigo-700 dark:text-indigo-300 rounded-lg">
          {t('domains.reorderHint')}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  <input
                    type="checkbox"
                    checked={displayedDomains.length > 0 && selectedDomainIds.length === displayedDomains.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">{t('common.order')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">{t('common.domain')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">{t('common.registrar')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">{t('domains.registered')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">{t('domains.expires')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">{t('common.price')}</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {displayedDomains.map((domain) => (
                <tr
                  key={domain.id}
                  className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-transform ${
                    draggingDomainId === domain.id ? 'bg-indigo-50 dark:bg-indigo-900/10 opacity-50' : ''
                  }`}
                  onDragOver={(e) => {
                    if (!isReorderMode) {
                      return;
                    }
                    e.preventDefault();
                    if (draggingDomainId && draggingDomainId !== domain.id) {
                      previewReorder(draggingDomainId, domain.id);
                    }
                  }}
                  onDrop={(e) => {
                    if (!isReorderMode) {
                      return;
                    }
                    e.preventDefault();
                    if (draggingDomainId) {
                      void handleReorder(draggingDomainId, domain.id);
                    }
                  }}
                  onDragEnd={() => {
                    setDraggingDomainId(null);
                    if (!savingReorder) {
                      setReorderDraft(null);
                    }
                  }}
                >
                  <td className="py-3 px-4">
                    <input
                    type="checkbox"
                    checked={selectedDomainIds.includes(domain.id)}
                    onChange={() => toggleDomainSelection(domain.id)}
                    disabled={isReorderMode}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      {isReorderMode && (
                        <button
                          type="button"
                          draggable={!savingReorder}
                          onDragStart={(e) => {
                            setDraggingDomainId(domain.id);
                            setReorderDraft(displayedDomains);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', domain.id);
                          }}
                          className="cursor-grab text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 disabled:opacity-50"
                          disabled={savingReorder}
                          aria-label={`Drag to reorder ${domain.name}`}
                        >
                          <Bars3Icon className="h-5 w-5" />
                        </button>
                      )}
                      <span>{domain.display_order}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-sm text-gray-900 dark:text-gray-100">{domain.name}</span>
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
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {domain.registration_date ? (
                      <div>
                        <div>{formatDateTime(domain.registration_date, dateTimeFormat) || domain.registration_date}</div>
                        <div className="text-xs text-gray-400">
                          {(() => {
                            const registeredFor = formatRegisteredDuration(daysSince(domain.registration_date));
                            return registeredFor ? t('domains.registeredFor', { duration: registeredFor }) : t('domains.registrationUnavailable');
                          })()}
                        </div>
                      </div>
                    ) : '\u2014'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {(() => {
                      const remaining = formatRegisteredDuration(daysUntil(domain.expiration_date));
                      return (
                    <div>
                      <div>{formatDateTime(domain.expiration_date, dateTimeFormat) || domain.expiration_date}</div>
                      <div className="text-xs text-gray-400">
                        {remaining ? t('domains.timeLeft', { duration: remaining }) : t('domains.expired')}
                      </div>
                    </div>
                      );
                    })()}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {domain.renew_price != null
                      ? formatCurrencyAmount(domain.renew_price, domain.currency)
                      : '\u2014'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleRefreshDomain(domain.id, domain.name)}
                        disabled={refreshingDomainIds.includes(domain.id) || isReorderMode}
                        className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 disabled:opacity-50"
                      >
                        {refreshingDomainIds.includes(domain.id) ? t('domains.refreshing') : t('domains.refreshRow')}
                      </button>
                      <button
                        onClick={() => navigate(`/admin/domains/${domain.id}/edit`)}
                        disabled={isReorderMode}
                        className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 disabled:opacity-50"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => handleDelete(domain.id)}
                        disabled={isReorderMode}
                        className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 disabled:opacity-50"
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {displayedDomains.length === 0 && (
            <div className="text-center py-12 text-gray-500">{t('domains.noDomainsYet')}</div>
          )}
        </div>
      )}
    </div>
  );
}
