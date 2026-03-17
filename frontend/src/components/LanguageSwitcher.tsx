import { GlobeAltIcon } from '@heroicons/react/24/outline';
import { useI18n, type Locale } from '../i18n';

interface LanguageSwitcherProps {
  compact?: boolean;
}

export default function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
      {compact ? <GlobeAltIcon className="h-4 w-4" /> : <span>{t('lang.label')}</span>}
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className={`bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          compact ? 'h-10 px-3' : 'px-2 py-1'
        }`}
      >
        <option value="en">{t('locale.english')}</option>
        <option value="zh-CN">{t('locale.chinese')}</option>
      </select>
    </label>
  );
}
