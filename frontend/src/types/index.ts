export type DateTimeDisplayFormat = 'slash_utc_offset' | 'iso_utc_offset' | 'locale_short';

export interface Registrar {
  id: string;
  name: string;
  website: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface Domain {
  id: string;
  name: string;
  display_order: number;
  favicon_url?: string | null;
  registrar_id: string | null;
  registrar: Registrar | null;
  tags: Tag[];
  registration_date: string | null;
  expiration_date: string;
  renewal_days: number;
  renew_price: string | number | null;
  currency: string;
  masking_level: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicDomain {
  name: string;
  id: string;
  registrar: Registrar | null;
  tags: Tag[];
  registration_date: string | null;
  expiration_date: string;
  registered_days: number | null;
  remaining_days: number;
  renewal_days: number;
  status: 'green' | 'yellow' | 'red';
  renew_price: string | number | null;
  currency: string;
  converted_price: string | number | null;
  favicon_url?: string | null;
}

export interface PublicDomainsResponse {
  domains: PublicDomain[];
  currency_totals: {
    display_currency: string;
    total: string | number;
  };
  available_currencies: string[];
  date_time_display_format: DateTimeDisplayFormat;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
}
