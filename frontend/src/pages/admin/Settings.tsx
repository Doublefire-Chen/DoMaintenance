import { useEffect, useState } from 'react';
import api from '../../api/client';
import type { DateTimeDisplayFormat } from '../../types';
import { getDateTimeFormatPreview } from '../../utils/date';
import { useI18n } from '../../i18n';

const DATE_TIME_FORMAT_OPTIONS: Array<{
  value: DateTimeDisplayFormat;
  label: (preview: string) => string;
}> = [
  { value: 'slash_utc_offset', label: (preview) => preview },
  { value: 'iso_utc_offset', label: (preview) => preview },
  { value: 'locale_short', label: (preview) => preview },
];

export default function Settings() {
  const { t } = useI18n();
  const [allowRegister, setAllowRegister] = useState(false);
  const [refreshIntervalHours, setRefreshIntervalHours] = useState('24');
  const [requestDelaySeconds, setRequestDelaySeconds] = useState('60');
  const [dateTimeFormat, setDateTimeFormat] = useState<DateTimeDisplayFormat>('slash_utc_offset');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [exportingMigration, setExportingMigration] = useState(false);
  const [importingMigration, setImportingMigration] = useState(false);
  const [migrationFile, setMigrationFile] = useState<File | null>(null);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);

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
        setMessage(t('settings.loadFailed'));
      })
      .finally(() => setLoading(false));
  }, [t]);

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
          ? t('settings.saved', { hours: intervalHours })
          : t('settings.savedDisabled'),
      );
    } catch (err) {
      console.error(err);
      setMessage(t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordMessage(null);

    if (newPassword.length < 8) {
      setPasswordMessage(t('settings.newPasswordShort'));
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordMessage(t('settings.newPasswordMismatch'));
      return;
    }

    setChangingPassword(true);

    try {
      const res = await api.post('/api/admin/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordMessage(res.data.message || t('settings.passwordUpdatedRedirect'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      window.setTimeout(() => {
        window.location.href = '/login';
      }, 800);
    } catch (err: unknown) {
      console.error(err);
      const responseError = typeof err === 'object'
        && err !== null
        && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      const errorMessage = typeof responseError === 'string'
        ? responseError
        : t('settings.passwordUpdateFailed');
      setPasswordMessage(errorMessage);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleExportMigration = async () => {
    setExportingMigration(true);
    setMigrationMessage(null);

    try {
      const res = await api.get('/api/admin/migration/export', {
        responseType: 'blob',
      });
      const blob = res.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `domaintenance-export-${dateStamp}.zip`;
      link.click();
      window.URL.revokeObjectURL(url);
      setMigrationMessage(t('settings.projectExported'));
    } catch (err) {
      console.error(err);
      setMigrationMessage(t('settings.projectExportFailed'));
    } finally {
      setExportingMigration(false);
    }
  };

  const handleImportMigration = async () => {
    if (!migrationFile) {
      setMigrationMessage(t('settings.selectFileFirst'));
      return;
    }

    if (!confirm(t('settings.importConfirm'))) {
      return;
    }

    setImportingMigration(true);
    setMigrationMessage(null);

    try {
      const payload = await migrationFile.arrayBuffer();
      const res = await api.post('/api/admin/migration/import', payload, {
        headers: {
          'Content-Type': 'application/zip',
        },
      });
      setMigrationMessage(res.data.message || t('settings.projectImportedRedirect'));
      setMigrationFile(null);
      window.setTimeout(() => {
        window.location.href = '/login';
      }, 800);
    } catch (err: unknown) {
      console.error(err);
      const responseError = typeof err === 'object'
        && err !== null
        && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      const errorMessage = typeof responseError === 'string'
        ? responseError
        : t('settings.projectImportFailed');
      setMigrationMessage(errorMessage);
    } finally {
      setImportingMigration(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('settings.title')}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('settings.subtitle')}
        </p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {t('settings.sectionRegistration')}
          </h3>

          <label className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('settings.allowRegister')}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('settings.allowRegisterHint')}
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
            {t('settings.sectionWhois')}
          </h3>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('settings.autoRefreshInterval')}
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
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('common.hours')}</span>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t('settings.autoRefreshHint')}
          </p>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-5 mb-1">
            {t('settings.requestDelay')}
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
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('common.seconds')}</span>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t('settings.requestDelayHint')}
          </p>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-5 mb-1">
            {t('settings.dateTimeFormat')}
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
            {t('settings.dateTimeFormatHint')}
          </p>

          <div className="mt-5">
            <button
              onClick={handleSave}
              disabled={loading || saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200 disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('settings.saveSettings')}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {t('settings.sectionPassword')}
          </h3>

          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('common.currentPassword')}
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading || changingPassword}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('common.newPassword')}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading || changingPassword}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('common.confirmNewPassword')}
              </label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                disabled={loading || changingPassword}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={handleChangePassword}
              disabled={
                loading
                || changingPassword
                || currentPassword.length === 0
                || newPassword.length === 0
                || confirmNewPassword.length === 0
              }
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200 disabled:opacity-50"
            >
              {changingPassword ? t('settings.updatingPassword') : t('settings.updatePassword')}
            </button>

            {passwordMessage && (
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 rounded-lg">
                {passwordMessage}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {t('settings.sectionMigration')}
          </h3>

          <div className="space-y-4 max-w-2xl">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('settings.migrationHint')}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleExportMigration}
                disabled={loading || exportingMigration || importingMigration}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200 disabled:opacity-50"
              >
                {exportingMigration ? t('settings.exporting') : t('settings.exportProject')}
              </button>

              <input
                type="file"
                accept="application/zip,.zip"
                disabled={loading || exportingMigration || importingMigration}
                onChange={(e) => setMigrationFile(e.target.files?.[0] || null)}
                className="block text-sm text-gray-600 dark:text-gray-300 file:mr-4 file:px-4 file:py-2 file:border-0 file:rounded-lg file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/20 dark:file:text-indigo-300"
              />

              <button
                onClick={handleImportMigration}
                disabled={loading || exportingMigration || importingMigration || migrationFile == null}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200 disabled:opacity-50"
              >
                {importingMigration ? t('settings.importing') : t('settings.importProject')}
              </button>
            </div>

            {migrationFile && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('common.selectedFile', { name: migrationFile.name })}
              </div>
            )}

            {migrationMessage && (
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 rounded-lg">
                {migrationMessage}
              </div>
            )}
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
