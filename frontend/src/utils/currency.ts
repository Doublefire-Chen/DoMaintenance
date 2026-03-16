export interface CurrencyOption {
  value: string;
  label: string;
}

type CurrencyAmount = number | string;

export const currencyOptions: CurrencyOption[] = [
  { value: 'USD', label: '🇺🇸 $ (US Dollar)' },
  { value: 'EUR', label: '🇪🇺 € (Euro)' },
  { value: 'SEK', label: '🇸🇪 kr (Swedish Krona)' },
  { value: 'GBP', label: '🇬🇧 £ (British Pound)' },
  { value: 'JPY', label: '🇯🇵 ¥ (Japanese Yen)' },
  { value: 'CNY', label: '🇨🇳 ¥ (Chinese Yuan)' },
  { value: 'CHF', label: '🇨🇭 Fr (Swiss Franc)' },
  { value: 'CAD', label: '🇨🇦 $ (Canadian Dollar)' },
  { value: 'AUD', label: '🇦🇺 $ (Australian Dollar)' },
];

export const supportedCurrencyCodes = currencyOptions.map(({ value }) => value);

export function normalizeCurrencyCode(value: string): string {
  return value.trim().toUpperCase().slice(0, 3);
}

function normalizeAmount(amount: CurrencyAmount): string {
  if (typeof amount === 'number') {
    return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
  }

  const trimmed = amount.trim();
  if (!trimmed) {
    return '0.00';
  }

  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
}

export function formatCurrencyAmount(amount: CurrencyAmount, currency: string): string {
  const normalizedCurrency = normalizeCurrencyCode(currency);
  const normalizedAmount = normalizeAmount(amount);

  return normalizedCurrency
    ? `${normalizedAmount} ${normalizedCurrency}`
    : normalizedAmount;
}

export function formatCurrencyOption(currency: string): string {
  const normalizedCurrency = normalizeCurrencyCode(currency);
  const option = currencyOptions.find(({ value }) => value === normalizedCurrency);

  return option ? option.label : normalizedCurrency;
}

export function isSupportedCurrency(currency: string): boolean {
  return supportedCurrencyCodes.includes(normalizeCurrencyCode(currency));
}
