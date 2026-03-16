import { useEffect, useState } from 'react';
import api from '../../api/client';
import type { DateTimeDisplayFormat } from '../../types';
import { getDateTimeFormatPreview } from '../../utils/date';

const DATE_TIME_FORMAT_OPTIONS: Array<{
  value: DateTimeDisplayFormat;
  label: (preview: string) => string;
}> = [
  { value: 'slash_utc_offset', label: (preview) => preview },
  { value: 'iso_utc_offset', label: (preview) => preview },
  { value: 'locale_short', label: (preview) => preview },
];

export default function Settings() {
  const [allowRegister, setAllowRegister] = useState(false);
  const [refreshIntervalHours, setRefreshIntervalHours] = useState('24');
  const [requestDelaySeconds, setRequestDelaySeconds] = useState('60');
  const [dateTimeFormat, setDateTimeFormat] = useState<DateTimeDisplayFormat>('slash_utc_offset');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/admin/settings')
      .then((res) => {
        setAllowRegister(res.data.allow_register === true);
        setRefreshIntervalHours(String(res.data.whois_refresh_interval_hours));
        setRequestDelaySeconds(String(Math.floor((res.data.whois_request_delay_ms ?? 0) / 1000)));
        setDateTimeFormat(res.data.date_time_display_format || 'slash_utc_offset');
      })
      .catch((err) => {
        console.error(err);
        setMessage('Failed to load settings.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const intervalHours = Math.max(0, parseInt(refreshIntervalHours, 10) || 0);
    const delaySeconds = Math.max(0, parseInt(requestDelaySeconds, 10) || 0);
    setSaving(true);
    setMessage(null);

    try {
      const res = await api.put('/api/admin/settings', {
        allow_register: allowRegister,
        whois_refresh_interval_hours: intervalHours,
        whois_request_delay_ms: delaySeconds * 1000,
        date_time_display_format: dateTimeFormat,
      });
      setAllowRegister(res.data.allow_register === true);
      setRefreshIntervalHours(String(res.data.whois_refresh_interval_hours));
      setRequestDelaySeconds(String(Math.floor((res.data.whois_request_delay_ms ?? 0) / 1000)));
      setDateTimeFormat(res.data.date_time_display_format || 'slash_utc_offset');
      setMessage(
        intervalHours > 0
          ? `Settings saved. Auto refresh runs every ${intervalHours} hour(s).`
          : 'Settings saved. Auto refresh is disabled.',
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
          Manage registration access and background domain refresh behavior.
        </p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Registration
          </h3>

          <label className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Allow new account registration
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Disable this after the first admin account is created if public sign-up is not needed.
              </p>
            </div>
            <input
              type="checkbox"
              checked={allowRegister}
              onChange={(e) => setAllowRegister(e.target.checked)}
              disabled={loading}
              className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            WHOIS Refresh
          </h3>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Auto Refresh Interval
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

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-5 mb-1">
            Delay Between Domain Requests
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="1"
              value={requestDelaySeconds}
              onChange={(e) => setRequestDelaySeconds(e.target.value)}
              disabled={loading}
              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">seconds</span>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Applied to both manual refresh and scheduled refresh to avoid RDAP throttling.
          </p>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-5 mb-1">
            Date and Time Display Format
          </label>
          <select
            value={dateTimeFormat}
            onChange={(e) => setDateTimeFormat(e.target.value as DateTimeDisplayFormat)}
            disabled={loading}
            className="w-full max-w-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {DATE_TIME_FORMAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label(getDateTimeFormatPreview(option.value))}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Controls how registration and expiration timestamps are shown across the app, using the viewer&apos;s local timezone.
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
        </div>

        {message && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 rounded-lg">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
