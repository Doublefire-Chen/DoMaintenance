import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client';
import type { Registrar, Tag } from '../../types';
import { currencyOptions, normalizeCurrencyCode } from '../../utils/currency';
import { fromDateTimeLocalInputValue, toDateTimeLocalInputValue } from '../../utils/date';

interface DomainFormData {
  name: string;
  registrar_id: string;
  registration_date: string;
  expiration_date: string;
  renewal_days: number;
  renew_price: string;
  currency: string;
  masking_level: number;
  notes: string;
  tag_ids: string[];
}

export default function DomainForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<DomainFormData>({
    name: '',
    registrar_id: '',
    registration_date: '',
    expiration_date: '',
    renewal_days: 365,
    renew_price: '',
    currency: 'USD',
    masking_level: 0,
    notes: '',
    tag_ids: [],
  });
  const [registrars, setRegistrars] = useState<Registrar[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [lookupMessage, setLookupMessage] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/api/admin/registrars'),
      api.get('/api/admin/tags'),
    ]).then(([regRes, tagRes]) => {
      setRegistrars(regRes.data);
      setTags(tagRes.data);
    });

    if (isEdit) {
      api.get(`/api/admin/domains/${id}`).then((res) => {
        const d = res.data;
        setForm({
          name: d.name,
          registrar_id: d.registrar_id || '',
          registration_date: toDateTimeLocalInputValue(d.registration_date),
          expiration_date: toDateTimeLocalInputValue(d.expiration_date),
          renewal_days: d.renewal_days,
          renew_price: d.renew_price?.toString() || '',
          currency: normalizeCurrencyCode(d.currency),
          masking_level: d.masking_level,
          notes: d.notes || '',
          tag_ids: d.tags?.map((t: Tag) => t.id) || [],
        });
      });
    }
  }, [id, isEdit]);

  const lookupDomain = async () => {
    const domain = form.name.trim();
    if (!domain || !domain.includes('.')) return;

    setLookupStatus('loading');
    setLookupMessage('');

    try {
      const res = await api.get(`/api/admin/whois/${encodeURIComponent(domain)}`);
      const data = res.data;
      const updates: Partial<DomainFormData> = {};

      if (data.expiration_date) {
        updates.expiration_date = toDateTimeLocalInputValue(data.expiration_date);
      }
      if (data.registration_date) {
        updates.registration_date = toDateTimeLocalInputValue(data.registration_date);
      }

      if (Object.keys(updates).length > 0) {
        setForm((prev) => ({ ...prev, ...updates }));
        setLookupStatus('success');
        setLookupMessage(
          `Fetched registration: ${data.registration_date || 'N/A'} • expiration: ${data.expiration_date || 'N/A'}`,
        );
      } else {
        setLookupStatus('error');
        setLookupMessage('No date info found for this domain');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setLookupStatus('error');
      setLookupMessage(msg || 'Could not look up domain info. You can enter dates manually.');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const payload = {
      name: form.name,
      registrar_id: form.registrar_id || null,
      registration_date: fromDateTimeLocalInputValue(form.registration_date),
      expiration_date: fromDateTimeLocalInputValue(form.expiration_date),
      renewal_days: form.renewal_days,
      renew_price: form.renew_price ? parseFloat(form.renew_price) : null,
      currency: normalizeCurrencyCode(form.currency),
      masking_level: form.masking_level,
      notes: form.notes || null,
      tag_ids: form.tag_ids,
    };

    try {
      if (isEdit) {
        await api.put(`/api/admin/domains/${id}`, payload);
      } else {
        await api.post('/api/admin/domains', payload);
      }
      navigate('/admin/domains');
    } catch {
      setError('Failed to save domain');
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setForm((prev) => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter((id) => id !== tagId)
        : [...prev.tag_ids, tagId],
    }));
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        {isEdit ? 'Edit Domain' : 'Add Domain'}
      </h2>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6 max-w-2xl">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Domain Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                maxLength={253}
                placeholder="example.com"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {!isEdit && (
                <button
                  type="button"
                  onClick={lookupDomain}
                  disabled={lookupStatus === 'loading' || !form.name.includes('.')}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 whitespace-nowrap"
                >
                  {lookupStatus === 'loading' ? 'Looking up...' : 'Fetch Dates'}
                </button>
              )}
            </div>
            {lookupMessage && (
              <p className={`mt-1 text-xs ${lookupStatus === 'success' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {lookupMessage}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Registrar</label>
              <select
                value={form.registrar_id}
                onChange={(e) => setForm({ ...form, registrar_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">None</option>
                {registrars.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Registration Time</label>
              <input
                type="datetime-local"
                value={form.registration_date}
                onChange={(e) => setForm({ ...form, registration_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expiration Time</label>
              <input
                type="datetime-local"
                value={form.expiration_date}
                onChange={(e) => setForm({ ...form, expiration_date: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-end">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Use "Fetch Dates" to autofill registration and expiration from RDAP when available.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Renewal Days</label>
              <input
                type="number"
                value={form.renewal_days}
                onChange={(e) => setForm({ ...form, renewal_days: parseInt(e.target.value) || 365 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Renewal Price</label>
              <input
                type="number"
                step="0.01"
                value={form.renew_price}
                onChange={(e) => setForm({ ...form, renew_price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: normalizeCurrencyCode(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {currencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Masking Level</label>
            <select
              value={form.masking_level}
              onChange={(e) => setForm({ ...form, masking_level: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={0}>0 - Visible</option>
              <option value={1}>1 - Partial (e******.com)</option>
              <option value={2}>2 - Heavy (***.com)</option>
              <option value={3}>3 - Full (***.***)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${form.tag_ids.includes(tag.id)
                      ? 'ring-2 ring-indigo-500 ring-offset-1'
                      : 'opacity-60 hover:opacity-100'
                      }`}
                    style={{
                      backgroundColor: tag.color ? `${tag.color}20` : '#e5e7eb',
                      color: tag.color || '#6b7280',
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors duration-200"
            >
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/domains')}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
