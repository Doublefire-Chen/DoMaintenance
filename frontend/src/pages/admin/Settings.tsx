import { useEffect, useState } from 'react';
import api from '../../api/client';

export default function Settings() {
  const [refreshIntervalHours, setRefreshIntervalHours] = useState('24');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/admin/settings/whois-refresh')
      .then((res) => setRefreshIntervalHours(String(res.data.interval_hours)))
      .catch((err) => {
        console.error(err);
        setMessage('Failed to load settings.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const intervalHours = Math.max(0, parseInt(refreshIntervalHours, 10) || 0);
    setSaving(true);
    setMessage(null);

    try {
      const res = await api.put('/api/admin/settings/whois-refresh', {
        interval_hours: intervalHours,
      });
      setRefreshIntervalHours(String(res.data.interval_hours));
      setMessage(
        intervalHours > 0
          ? `Auto refresh saved: every ${intervalHours} hour(s).`
          : 'Auto refresh disabled.',
      );
    } catch (err) {
      console.error(err);
      setMessage('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage background WHOIS refresh behavior for domain registration and expiration dates.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 max-w-xl">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          WHOIS Auto Refresh
        </h3>

        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Refresh Interval
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="1"
            value={refreshIntervalHours}
            onChange={(e) => setRefreshIntervalHours(e.target.value)}
            disabled={loading}
            className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">hours</span>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Set to `0` to disable the background refresh task.
        </p>

        <div className="mt-5">
          <button
            onClick={handleSave}
            disabled={loading || saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {message && (
          <div className="mt-4 px-4 py-3 bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 rounded-lg">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
