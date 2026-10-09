export interface Product {
  id: string;
  slug: string;
  sku: string | null;
  name: string;
  short_description: string | null;
  description: string | null;
  collection_slug: string | null;
  occasion: string | null;
  range_label: string | null;
  fabric: string | null;
  weave: string | null;
  work: string | null;
  care: string | null;
  dimensions: string | null;
  price: number;
  compare_at_price: number | null;
  price_on_request: boolean;
  stock: number;
  low_stock_threshold: number;
  sizes: string[];
  colors: string[];
  tags: string[];
  images: string[];
  is_featured: boolean;
  is_best_seller: boolean;
  is_new_arrival: boolean;
  is_active: boolean;
  is_deleted: boolean;
  sort_order: number;
  in_stock: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Collection {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  product_count: number;
}

/** "Our Legacy" — a personality photographed in a Paithani, with their review. */
export interface LegacyReview {
  id: string;
  celebrity_name: string;
  title: string | null;
  review: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

/** An exhibition the studio has shown at, with photos and a write-up. */
export interface Exhibition {
  id: string;
  title: string;
  location: string | null;
  event_date: string | null;
  description: string | null;
  images: string[];
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface Facets {
  collections: { value: string; total: number }[];
  occasions: { value: string; total: number }[];
  ranges: { value: string; total: number }[];
}

export interface StoreSettings {
  store_name: string;
  store_tagline: string;
  store_phone: string;
  store_whatsapp: string;
  store_email: string;
  store_address: string;
  store_upi: string;
  store_bank: string;
  store_instagram: string;
  default_country_code: string;
  advance_percent: string;
  whatsapp_template: string;
  enquiry_notice: string;
}

export type PublicSettings = Pick<
  StoreSettings,
  | 'store_name'
  | 'store_tagline'
  | 'store_phone'
  | 'store_whatsapp'
  | 'store_email'
  | 'store_address'
  | 'store_upi'
  | 'store_instagram'
  | 'advance_percent'
  | 'enquiry_notice'
>;

export type EnquiryStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';

export interface EnquiryItem {
  id: string;
  product_id: string | null;
  product_name: string;
  product_slug: string | null;
  unit_price: number;
  quantity: number;
  size: string | null;
  color: string | null;
  notes: string | null;
  line_total: number;
}

export interface EnquiryMessage {
  id: string;
  channel: string;
  phone: string;
  body: string;
  status: string;
  created_at: string;
}

export interface Enquiry {
  id: string;
  reference: string;
  customer_name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  occasion_date: string | null;
  customer_note: string | null;
  source: string;
  status: EnquiryStatus;
  item_count: number;
  quoted_total: number | null;
  advance_amount: number | null;
  payment_note: string | null;
  admin_note: string | null;
  rejection_reason: string | null;
  last_message: string | null;
  approved_at: string | null;
  whatsapp_sent_at: string | null;
  stock_released: boolean;
  created_at: string;
  items?: EnquiryItem[];
  messages?: EnquiryMessage[];
}

export interface WhatsAppPayload {
  phone: string;
  message: string;
  chat_url: string;
  send_url: string;
  /** Public URL of the payment QR image linked from the message ('' if unknown). */
  qr_url?: string;
}

export interface AdminStats {
  enquiries: {
    total: number;
    pending: number;
    approved: number;
    completed: number;
    rejected: number;
    approved_value: number;
    earned_value: number;
  };
  products: {
    total: number;
    active: number;
    out_of_stock: number;
    low_stock: number;
    units: number;
  };
  recent: { reference: string; customer_name: string; status: EnquiryStatus; quoted_total: number | null; created_at: string }[];
  low_stock: { id: string; name: string; stock: number; low_stock_threshold: number }[];
}

export interface EnquiryDraftItem {
  product: Pick<Product, 'id' | 'slug' | 'name' | 'price' | 'images' | 'sizes' | 'colors'>;
  quantity: number;
  size: string;
  color: string;
  notes: string;
}
