import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon } from '@heroicons/react/24/outline';
import api from '../../api/client';
import type { Domain } from '../../types';
import { formatCurrencyAmount } from '../../utils/currency';
import { daysSince, formatRegisteredDuration } from '../../utils/date';

export default function DomainList() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchDomains = () => {
    setLoading(true);
    api.get('/api/admin/domains')
      .then((res) => setDomains(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDomains(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this domain?')) return;
    try {
      await api.delete(`/api/admin/domains/${id}`);
      fetchDomains();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Domains</h2>
        <Link
          to="/admin/domains/new"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
        >
          <PlusIcon className="h-4 w-4" />
          Add Domain
        </Link>
      </div>

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
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Domain</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Registrar</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Registered</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Expires</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Price</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <tr key={domain.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 px-4 font-mono text-sm text-gray-900 dark:text-gray-100">{domain.name}</td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{domain.registrar?.name || '\u2014'}</td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {domain.registration_date ? (
                      <div>
                        <div>{domain.registration_date}</div>
                        <div className="text-xs text-gray-400">
                          {formatRegisteredDuration(daysSince(domain.registration_date))}
                        </div>
                      </div>
                    ) : '\u2014'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{domain.expiration_date}</td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {domain.renew_price != null
                      ? formatCurrencyAmount(domain.renew_price, domain.currency)
                      : '\u2014'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => navigate(`/admin/domains/${domain.id}/edit`)}
                        className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(domain.id)}
                        className="text-sm text-red-600 hover:text-red-800 dark:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {domains.length === 0 && (
            <div className="text-center py-12 text-gray-500">No domains yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
