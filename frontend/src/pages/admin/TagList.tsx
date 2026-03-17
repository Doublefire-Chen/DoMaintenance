import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../../api/client';
import type { Tag } from '../../types';
import { useI18n } from '../../i18n';

export default function TagList() {
  const { t } = useI18n();
  const actionButtonClass = 'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-200';
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchTags = () => {
    setLoading(true);
    api.get('/admin/tags')
      .then((res) => setTags(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTags(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(t('tags.deleteConfirm'))) return;
    try {
      await api.delete(`/admin/tags/${id}`);
      fetchTags();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('tags.title')}</h2>
        <Link
          to="/admin/tags/new"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
        >
          <PlusIcon className="h-4 w-4" />
          {t('tags.addTag')}
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {tags.map((tag) => (
              <div key={tag.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span
                      className="inline-flex px-3 py-1 rounded-full text-sm font-medium"
                      style={{
                        backgroundColor: tag.color ? `${tag.color}20` : '#e5e7eb',
                        color: tag.color || '#6b7280',
                      }}
                    >
                      {tag.name}
                    </span>
                    <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                      {tag.color ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                          {tag.color}
                        </div>
                      ) : '\u2014'}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => navigate(`/admin/tags/${tag.id}/edit`)}
                      title={t('common.edit')}
                      aria-label={t('common.edit')}
                      className={`${actionButtonClass} text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/20`}
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(tag.id)}
                      title={t('common.delete')}
                      aria-label={t('common.delete')}
                      className={`${actionButtonClass} text-red-600 hover:bg-red-50 hover:text-red-800 dark:text-red-400 dark:hover:bg-red-900/20`}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900 md:block">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">{t('common.name')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">{t('common.color')}</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr key={tag.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 px-4">
                    <span
                      className="px-3 py-1 rounded-full text-sm font-medium"
                      style={{
                        backgroundColor: tag.color ? `${tag.color}20` : '#e5e7eb',
                        color: tag.color || '#6b7280',
                      }}
                    >
                      {tag.name}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {tag.color ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                        {tag.color}
                      </div>
                    ) : '\u2014'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => navigate(`/admin/tags/${tag.id}/edit`)}
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                        className={`${actionButtonClass} text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/20`}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(tag.id)}
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
          </div>
          {tags.length === 0 && (
            <div className="text-center py-12 text-gray-500">{t('tags.noTags')}</div>
          )}
        </>
      )}
    </div>
  );
}
