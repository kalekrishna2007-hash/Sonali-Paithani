-- Sonali Paithani — database schema.
-- Runs automatically on server boot (all statements are idempotent), and can be
-- pasted into the Supabase SQL editor.

create table if not exists admin_users (
  id            text primary key,
  email         text not null unique,
  name          text not null default 'Administrator',
  password_hash text not null,
  role          text not null default 'admin',
  last_login_at timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists collections (
  id          text primary key,
  slug        text not null unique,
  name        text not null,
  tagline     text,
  description text,
  image_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists products (
  id                  text primary key,
  slug                text not null unique,
  sku                 text,
  name                text not null,
  short_description   text,
  description         text,
  collection_slug     text,
  occasion            text,
  range_label         text,
  fabric              text,
  weave               text,
  work                text,
  care                text,
  dimensions          text,
  price               numeric(12, 2) not null default 0,
  compare_at_price    numeric(12, 2),
  price_on_request    boolean not null default true,
  stock               integer not null default 0,
  low_stock_threshold integer not null default 2,
  sizes               jsonb not null default '[]',
  colors              jsonb not null default '[]',
  tags                jsonb not null default '[]',
  images              jsonb not null default '[]',
  is_featured         boolean not null default false,
  is_best_seller      boolean not null default false,
  is_new_arrival      boolean not null default false,
  is_active           boolean not null default true,
  is_deleted          boolean not null default false,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists products_collection_idx on products (collection_slug);
create index if not exists products_active_idx on products (is_active, is_deleted);

create table if not exists enquiries (
  id                text primary key,
  reference         text not null unique,
  customer_name     text not null,
  phone             text not null,
  whatsapp          text,
  email             text,
  city              text,
  country           text,
  occasion_date     text,
  customer_note     text,
  source            text not null default 'website',
  status            text not null default 'pending',
  item_count        integer not null default 0,
  quoted_total      numeric(12, 2),
  advance_amount    numeric(12, 2),
  payment_note      text,
  admin_note        text,
  rejection_reason  text,
  last_message      text,
  approved_at       timestamptz,
  whatsapp_sent_at  timestamptz,
  stock_released    boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists enquiries_status_idx on enquiries (status, created_at);

create table if not exists enquiry_items (
  id           text primary key,
  enquiry_id   text not null references enquiries (id) on delete cascade,
  product_id   text,
  product_name text not null,
  product_slug text,
  unit_price   numeric(12, 2) not null default 0,
  quantity     integer not null default 1,
  size         text,
  color        text,
  notes        text,
  line_total   numeric(12, 2) not null default 0
);

create index if not exists enquiry_items_enquiry_idx on enquiry_items (enquiry_id);

create table if not exists stock_movements (
  id         text primary key,
  product_id text not null references products (id) on delete cascade,
  delta      integer not null,
  balance    integer not null,
  reason     text not null default 'manual',
  reference  text,
  actor      text,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_product_idx on stock_movements (product_id, created_at);

create table if not exists message_log (
  id           text primary key,
  enquiry_id   text not null references enquiries (id) on delete cascade,
  channel      text not null default 'whatsapp',
  phone        text not null,
  body         text not null,
  status       text not null default 'queued',
  provider     text not null default 'wa.me',
  actor        text,
  created_at   timestamptz not null default now()
);

create index if not exists message_log_enquiry_idx on message_log (enquiry_id);

-- "Our Legacy": personalities photographed in a Paithani, with their review.
create table if not exists legacy_reviews (
  id             text primary key,
  celebrity_name text not null,
  title          text,
  review         text,
  image_url      text,
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Exhibitions the studio has shown at: title, place, photos and a write-up.
create table if not exists exhibitions (
  id          text primary key,
  title       text not null,
  location    text,
  event_date  text,
  description text,
  images      jsonb not null default '[]',
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);
