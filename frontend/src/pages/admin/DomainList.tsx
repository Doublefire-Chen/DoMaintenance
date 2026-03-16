import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon } from '@heroicons/react/24/outline';
import api from '../../api/client';
import type { Domain } from '../../types';
import { formatCurrencyAmount } from '../../utils/currency';
import { daysSince, formatRegisteredDuration } from '../../utils/date';

export default function DomainList() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingWhois, setRefreshingWhois] = useState(false);
  const [refreshingDomainIds, setRefreshingDomainIds] = useState<string[]>([]);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchDomains = () => {
    setLoading(true);
    api.get('/api/admin/domains')
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
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this domain?')) return;
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
        `Refreshed ${summary.updated} of ${summary.total_domains} domains${summary.failed > 0 ? `, ${summary.failed} failed` : ''}.`,
      );
    } catch (err) {
      console.error(err);
      setRefreshMessage('Failed to refresh RDAP dates.');
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
        `Refreshed ${domainName}: ${summary.updated} updated${summary.failed > 0 ? `, ${summary.failed} failed` : ''}.`,
      );
    } catch (err) {
      console.error(err);
      setRefreshMessage(`Failed to refresh RDAP dates for ${domainName}.`);
    } finally {
      setRefreshingDomainIds((prev) => prev.filter((domainId) => domainId !== id));
    }
  };

  const toggleDomainSelection = (id: string) => {
    setSelectedDomainIds((prev) => (
      prev.includes(id)
        ? prev.filter((domainId) => domainId !== id)
        : [...prev, id]
    ));
  };

  const toggleSelectAll = () => {
    if (selectedDomainIds.length === domains.length) {
      setSelectedDomainIds([]);
      return;
    }

    setSelectedDomainIds(domains.map((domain) => domain.id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Domains</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Refresh registration and expiration dates manually for all or only the selected domains.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefreshWhois}
            disabled={refreshingWhois}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200 disabled:opacity-50"
          >
            {refreshingWhois
              ? 'Refreshing...'
              : selectedDomainIds.length > 0
                ? `Refresh Selected (${selectedDomainIds.length})`
                : 'Refresh All Dates'}
          </button>
          <Link
            to="/admin/domains/new"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
          >
            <PlusIcon className="h-4 w-4" />
            Add Domain
          </Link>
        </div>
      </div>

      {refreshMessage && (
        <div className="mb-4 px-4 py-3 bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 rounded-lg">
          {refreshMessage}
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
                    checked={domains.length > 0 && selectedDomainIds.length === domains.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
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
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedDomainIds.includes(domain.id)}
                      onChange={() => toggleDomainSelection(domain.id)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
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
                        onClick={() => handleRefreshDomain(domain.id, domain.name)}
                        disabled={refreshingDomainIds.includes(domain.id)}
                        className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 disabled:opacity-50"
                      >
                        {refreshingDomainIds.includes(domain.id) ? 'Refreshing...' : 'Refresh'}
                      </button>
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
