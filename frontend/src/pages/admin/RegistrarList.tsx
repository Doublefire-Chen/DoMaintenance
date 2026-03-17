import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowPathIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../../api/client';
import type { Registrar } from '../../types';
import { useI18n } from '../../i18n';

export default function RegistrarList() {
  const { t } = useI18n();
  const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const actionButtonClass = 'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-200 disabled:opacity-50';
  const [registrars, setRegistrars] = useState<Registrar[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingRegistrarIds, setRefreshingRegistrarIds] = useState<string[]>([]);
  const [faviconVersionByRegistrarId, setFaviconVersionByRegistrarId] = useState<Record<string, number>>({});
  const [hiddenRegistrarFaviconIds, setHiddenRegistrarFaviconIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchRegistrars = () => {
    setLoading(true);
    api.get('/api/admin/registrars')
      .then((res) => setRegistrars(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRegistrars(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(t('registrars.deleteConfirm'))) return;
    try {
      await api.delete(`/api/admin/registrars/${id}`);
      fetchRegistrars();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefreshFavicons = async (registrarId: string, registrarName: string) => {
    setRefreshingRegistrarIds((prev) => [...prev, registrarId]);
    setMessage(null);

    try {
      const res = await api.post(`/api/admin/registrars/${registrarId}/refresh-favicons`);
      const summary = res.data as {
        fetched: number;
        total_domains: number;
        covered_domains: number;
        failed: number;
      };
      if (summary.fetched > 0) {
        setFaviconVersionByRegistrarId((prev) => ({
          ...prev,
          [registrarId]: Date.now(),
        }));
        setHiddenRegistrarFaviconIds((prev) => prev.filter((id) => id !== registrarId));
      }
      setMessage(
        t('registrars.refreshSummary', {
          name: registrarName,
          fetched: summary.fetched,
          covered: summary.covered_domains,
          failedSuffix: summary.failed > 0 ? t('domains.failedSuffix', { count: summary.failed }) : '',
        }),
      );
    } catch (err) {
      console.error(err);
      setMessage(t('registrars.refreshFail', { name: registrarName }));
    } finally {
      setRefreshingRegistrarIds((prev) => prev.filter((id) => id !== registrarId));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('registrars.title')}</h2>
        <Link
          to="/admin/registrars/new"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
        >
          <PlusIcon className="h-4 w-4" />
          {t('registrars.addRegistrar')}
        </Link>
      </div>

      {message && (
        <div className="mb-4 px-4 py-3 bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 rounded-lg">
          {message}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">{t('common.name')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">{t('common.website')}</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {registrars.map((reg) => (
                <tr key={reg.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                    <div className="flex items-center gap-2">
                      {reg.website ? (
                        <img
                          key={`${reg.id}-${faviconVersionByRegistrarId[reg.id] ?? 0}`}
                          src={`${apiBaseUrl}/api/public/registrar-favicons/${reg.id}?v=${faviconVersionByRegistrarId[reg.id] ?? 0}`}
                          alt=""
                          className="h-5 w-5 rounded"
                          loading="lazy"
                          style={{ display: hiddenRegistrarFaviconIds.includes(reg.id) ? 'none' : undefined }}
                          onError={() => {
                            setHiddenRegistrarFaviconIds((prev) => (
                              prev.includes(reg.id) ? prev : [...prev, reg.id]
                            ));
                          }}
                          onLoad={() => {
                            setHiddenRegistrarFaviconIds((prev) => prev.filter((id) => id !== reg.id));
                          }}
                        />
                      ) : (
                        <div className="h-5 w-5 rounded bg-gray-100 dark:bg-gray-800" />
                      )}
                      <span>{reg.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {reg.website ? (
                      <a href={reg.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                        {reg.website}
                      </a>
                    ) : '\u2014'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleRefreshFavicons(reg.id, reg.name)}
                        disabled={refreshingRegistrarIds.includes(reg.id)}
                        title={refreshingRegistrarIds.includes(reg.id) ? t('registrars.refreshingFavicons') : t('registrars.refreshFavicons')}
                        aria-label={refreshingRegistrarIds.includes(reg.id) ? t('registrars.refreshingFavicons') : t('registrars.refreshFavicons')}
                        className={`${actionButtonClass} text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-800`}
                      >
                        <ArrowPathIcon className={`h-4 w-4 ${refreshingRegistrarIds.includes(reg.id) ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => navigate(`/admin/registrars/${reg.id}/edit`)}
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                        className={`${actionButtonClass} text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/20`}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(reg.id)}
                        title={t('common.delete')}
                        aria-label={t('common.delete')}
                        className={`${actionButtonClass} text-red-600 hover:bg-red-50 hover:text-red-800 dark:text-red-400 dark:hover:bg-red-900/20`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {registrars.length === 0 && (
            <div className="text-center py-12 text-gray-500">{t('registrars.noRegistrars')}</div>
          )}
        </div>
      )}
    </div>
  );
}
