import type {
  AdminStats,
  Collection,
  Enquiry,
  EnquiryStatus,
  Exhibition,
  Facets,
  LegacyEntry,
  Product,
  PublicSettings,
  StoreSettings,
  WhatsAppPayload,
} from './types';

const TOKEN_KEY = 'sp_admin_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY) || '',
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit & { admin?: boolean } = {}): Promise<T> {
  const { admin, ...init } = options;
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.body && !(init.body instanceof FormData)) headers['content-type'] = 'application/json';
  if (admin) {
    const token = tokenStore.get();
    if (token) headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    if (res.status === 401 && admin) tokenStore.clear();
    throw new ApiError((data as { error?: string }).error || 'Something went wrong', res.status);
  }
  return data as T;
}

const query = (params: object) => {
  const search = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === false) return;
    search.set(key, String(value));
  });
  const string = search.toString();
  return string ? `?${string}` : '';
};

export interface ProductQuery {
  q?: string;
  collection?: string;
  occasion?: string;
  range?: string;
  sort?: string;
  featured?: boolean;
  best_seller?: boolean;
  new_arrival?: boolean;
  in_stock?: boolean;
  price_min?: number;
  price_max?: number;
  limit?: number;
  offset?: number;
  include_deleted?: boolean;
}

export interface TrackedEnquiry {
  reference: string;
  status: EnquiryStatus;
  customer_name: string;
  quoted_total: number | null;
  advance_amount: number | null;
  created_at: string;
  approved_at: string | null;
  items?: { product_name: string; quantity: number }[];
}

export interface EnquiryPayload {
  customer_name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  city?: string;
  occasion_date?: string;
  customer_note?: string;
  source?: string;
  items: {
    product_id: string;
    quantity: number;
    size?: string;
    color?: string;
    notes?: string;
  }[];
}

export const api = {
  health: () => request<{ ok: boolean; store: string }>('/api/health'),
  settings: () => request<PublicSettings>('/api/settings'),
  collections: () => request<{ collections: Collection[] }>('/api/collections'),
  facets: () => request<Facets>('/api/facets'),
  legacy: () => request<{ legacy: LegacyEntry[] }>('/api/legacy'),
  exhibitions: () => request<{ exhibitions: Exhibition[] }>('/api/exhibitions'),
  products: (params: ProductQuery = {}) =>
    request<{ rows: Product[]; total: number }>(`/api/products${query(params)}`),
  product: (slug: string) => request<{ product: Product; related: Product[] }>(`/api/products/${slug}`),
  createEnquiry: (payload: EnquiryPayload) =>
    request<{
      enquiry: { reference: string; status: EnquiryStatus; customer_name: string; quoted_total: number; item_count: number };
      items: { product_name: string; quantity: number; line_total: number }[];
      message: string;
    }>('/api/enquiries', { method: 'POST', body: JSON.stringify(payload) }),
  enquiryStatus: (reference: string, phone: string) =>
    request<TrackedEnquiry>(`/api/enquiries/${encodeURIComponent(reference)}${query({ phone })}`),
};

export const adminApi = {
  login: (email: string, password: string) =>
    request<{ token: string; admin: { id: string; email: string; name: string } }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ admin: { id: string; email: string; name: string } }>('/api/admin/me', { admin: true }),
  meta: () => request<{ storage: string; settings: StoreSettings; facets: Facets }>('/api/admin/meta', { admin: true }),
  stats: () => request<AdminStats>('/api/admin/stats', { admin: true }),

  products: (params: ProductQuery = {}) =>
    request<{ rows: Product[]; total: number }>(`/api/admin/products${query(params)}`, { admin: true }),
  product: (id: string) => request<{ product: Product }>(`/api/admin/products/${id}`, { admin: true }),
  createProduct: (body: Partial<Product>) =>
    request<{ product: Product }>('/api/admin/products', { method: 'POST', body: JSON.stringify(body), admin: true }),
  updateProduct: (id: string, body: Partial<Product>) =>
    request<{ product: Product }>(`/api/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(body), admin: true }),
  deleteProduct: (id: string, hard = false) =>
    request<{ product?: Product; deleted?: boolean }>(`/api/admin/products/${id}${hard ? '?hard=true' : ''}`, {
      method: 'DELETE',
      admin: true,
    }),
  restoreProduct: (id: string) =>
    request<{ product: Product }>(`/api/admin/products/${id}/restore`, { method: 'POST', admin: true }),
  adjustStock: (id: string, body: { delta?: number; set_to?: number; reason?: string; reference?: string }) =>
    request<{ product: Product; change: { balance: number; delta: number; oversold: boolean } }>(
      `/api/admin/products/${id}/stock`,
      { method: 'POST', body: JSON.stringify(body), admin: true },
    ),
  stockHistory: (id: string) =>
    request<{ current: number; movements: { id: string; delta: number; balance: number; reason: string; reference: string | null; actor: string | null; created_at: string }[] }>(
      `/api/admin/products/${id}/stock`,
      { admin: true },
    ),

  collections: () => request<{ collections: Collection[] }>('/api/admin/collections', { admin: true }),
  createCollection: (body: Partial<Collection>) =>
    request<{ collection: Collection }>('/api/admin/collections', { method: 'POST', body: JSON.stringify(body), admin: true }),
  updateCollection: (id: string, body: Partial<Collection>) =>
    request<{ collection: Collection }>(`/api/admin/collections/${id}`, { method: 'PATCH', body: JSON.stringify(body), admin: true }),

  enquiries: (params: { status?: string; search?: string } = {}) =>
    request<{ rows: Enquiry[]; counts: Record<string, number> }>(`/api/admin/enquiries${query(params)}`, { admin: true }),
  enquiry: (id: string) => request<{ enquiry: Enquiry }>(`/api/admin/enquiries/${id}`, { admin: true }),
  previewApproval: (id: string, body: { total_amount?: number; advance_amount?: number; payment_note?: string; message?: string }) =>
    request<{ enquiry: Enquiry; whatsapp: WhatsAppPayload }>(`/api/admin/enquiries/${id}/preview`, {
      method: 'POST',
      body: JSON.stringify(body),
      admin: true,
    }),
  approve: (
    id: string,
    body: { total_amount: number; advance_amount: number; payment_note?: string; admin_note?: string; message?: string; deduct_stock?: boolean },
  ) =>
    request<{ enquiry: Enquiry; whatsapp: WhatsAppPayload; stock_changes: { name: string; balance: number; oversold: boolean }[] }>(
      `/api/admin/enquiries/${id}/approve`,
      { method: 'POST', body: JSON.stringify(body), admin: true },
    ),
  markSent: (id: string, message: string) =>
    request<{ enquiry: Enquiry }>(`/api/admin/enquiries/${id}/sent`, {
      method: 'POST',
      body: JSON.stringify({ message }),
      admin: true,
    }),
  setStatus: (id: string, status: EnquiryStatus, reason?: string) =>
    request<{ enquiry: Enquiry }>(`/api/admin/enquiries/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
      admin: true,
    }),

  legacy: () => request<{ legacy: LegacyEntry[] }>('/api/admin/legacy', { admin: true }),
  createLegacy: (body: Partial<LegacyEntry>) =>
    request<{ entry: LegacyEntry }>('/api/admin/legacy', { method: 'POST', body: JSON.stringify(body), admin: true }),
  updateLegacy: (id: string, body: Partial<LegacyEntry>) =>
    request<{ entry: LegacyEntry }>(`/api/admin/legacy/${id}`, { method: 'PATCH', body: JSON.stringify(body), admin: true }),
  deleteLegacy: (id: string) =>
    request<{ deleted: boolean }>(`/api/admin/legacy/${id}`, { method: 'DELETE', admin: true }),

  exhibitions: () => request<{ exhibitions: Exhibition[] }>('/api/admin/exhibitions', { admin: true }),
  createExhibition: (body: Partial<Exhibition>) =>
    request<{ exhibition: Exhibition }>('/api/admin/exhibitions', { method: 'POST', body: JSON.stringify(body), admin: true }),
  updateExhibition: (id: string, body: Partial<Exhibition>) =>
    request<{ exhibition: Exhibition }>(`/api/admin/exhibitions/${id}`, { method: 'PATCH', body: JSON.stringify(body), admin: true }),
  deleteExhibition: (id: string) =>
    request<{ deleted: boolean }>(`/api/admin/exhibitions/${id}`, { method: 'DELETE', admin: true }),

  changePassword: (body: { current_password: string; new_password: string; confirm_password: string }) =>
    request<{ updated: boolean; message: string }>('/api/admin/password', {
      method: 'POST',
      body: JSON.stringify(body),
      admin: true,
    }),

  settings: () => request<{ settings: StoreSettings; default_template?: string }>('/api/admin/settings', { admin: true }),
  saveSettings: (body: Partial<StoreSettings>) =>
    request<{ settings: StoreSettings }>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(body), admin: true }),

  upload: (files: FileList | File[]) =>
    request<{ images: { url: string }[]; urls: string[] }>('/api/admin/uploads', {
      method: 'POST',
      body: (() => {
        const form = new FormData();
        Array.from(files).forEach((file) => form.append('images', file));
        return form;
      })(),
      admin: true,
    }),
  /**
   * One gallery photo or video clip. Called once per file so a large video is
   * never buffered together with the rest of the selection.
   */
  uploadMedia: (file: File) =>
    request<{ media: { url: string }; url: string }>('/api/admin/uploads/media', {
      method: 'POST',
      body: (() => {
        const form = new FormData();
        form.append('file', file);
        return form;
      })(),
      admin: true,
    }),
};
