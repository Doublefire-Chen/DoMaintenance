import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client';
import { useI18n } from '../../i18n';

export default function RegistrarForm() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit) {
      api.get(`/api/admin/registrars/${id}`).then((res) => {
        setName(res.data.name);
        setWebsite(res.data.website || '');
      });
    }
  }, [id, isEdit]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const normalizedWebsite = website && !/^https?:\/\//i.test(website) ? `https://${website}` : website;
    const payload = { name, website: normalizedWebsite || null };

    try {
      if (isEdit) {
        await api.put(`/api/admin/registrars/${id}`, payload);
      } else {
        await api.post('/api/admin/registrars', payload);
      }
      navigate('/admin/registrars');
    } catch {
      setError(t('registrarForm.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        {isEdit ? t('registrarForm.editTitle') : t('registrarForm.addTitle')}
      </h2>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6 max-w-md">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm rounded-lg">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.website')}</label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="example.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={loading} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors duration-200">
              {loading ? t('common.saving') : isEdit ? t('common.update') : t('common.create')}
            </button>
            <button type="button" onClick={() => navigate('/admin/registrars')} className="px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors duration-200">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
