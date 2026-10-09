import { one, q } from './db.js';
import { newId } from './auth.js';
import { createProduct, slugify } from './services/products.js';
import { updateSettings } from './services/settings.js';

export const COLLECTIONS = [
  {
    name: 'Traditional Paithani',
    tagline: 'Heirloom classics',
    description: 'Pure silk Yeola Paithani in classic munni and peacock borders.',
    image_url: '/images/paithani-1.svg',
    sort_order: 1,
  },
  {
    name: 'Bridal Collection',
    tagline: 'For the wedding trousseau',
    description: 'Deep zari, lotus butis and long pallus woven for the big day.',
    image_url: '/images/paithani-2.svg',
    sort_order: 2,
  },
  {
    name: 'Contemporary Paithani',
    tagline: 'Modern drape, old hands',
    description: 'Pastel palettes, lighter weights and geometric borders.',
    image_url: '/images/paithani-3.svg',
    sort_order: 3,
  },
  {
    name: 'Sarees by Color',
    tagline: 'Pick your palette',
    description: 'From peacock green to royal blue and maroon.',
    image_url: '/images/paithani-4.svg',
    sort_order: 4,
  },
];

const DEMO_PRODUCTS = [
  {
    name: 'Peacock Munni Paithani',
    collection_slug: 'traditional-paithani',
    occasion: 'Festive',
    range_label: 'Heritage',
    short_description: 'Peacock munni pallu with 2-ply mulberry silk and tested gold zari.',
    description:
      'Handwoven on a pit loom over 90 days by our Yeola artisans. The pallu carries the classic peacock munni motif with 24k gold-tested zari. A saree that passes down, not out.',
    fabric: 'Pure Mulberry Silk',
    weave: 'Handloom Katan',
    work: 'Gold Zari Munni',
    care: 'Dry clean only. Store rolled in muslin.',
    dimensions: 'Saree 6.30 m x 1.16 m, Blouse 0.80 m',
    price: 68000,
    compare_at_price: 78000,
    stock: 3,
    images: ['/images/paithani-1.svg', '/images/paithani-5.svg'],
    colors: ['Peacock Green', 'Maroon'],
    sizes: ['6.3 M with Blouse', '5.5 M without Blouse'],
    tags: ['paithani', 'peacock', 'bridal-heirloom'],
    is_featured: true,
    is_best_seller: true,
  },
  {
    name: 'Royal Lotus Bridal Paithani',
    collection_slug: 'bridal-collection',
    occasion: 'Bridal',
    range_label: 'Signature',
    short_description: 'Lotus buti body with heavy kadiyal border in 24k zari.',
    description:
      'Our signature bridal drape: a lotus buti field with a heavy kadiyal border and long zari pallu. Made to order in your choice of colour pairing.',
    fabric: 'Pure Mulberry Silk',
    weave: 'Handloom Kadiyal',
    work: 'Lotus Buti, Zari Border',
    care: 'Dry clean only.',
    dimensions: 'Saree 6.30 m x 1.16 m, Blouse 0.90 m',
    price: 145000,
    compare_at_price: 168000,
    stock: 2,
    images: ['/images/paithani-2.svg', '/images/paithani-6.svg'],
    colors: ['Maroon', 'Rani Pink', 'Bottle Green'],
    sizes: ['6.3 M with Blouse'],
    tags: ['bridal', 'lotus', 'heavy-zari'],
    is_featured: true,
    is_best_seller: true,
  },
  {
    name: 'Yeola Heritage Muniya',
    collection_slug: 'traditional-paithani',
    occasion: 'Festive',
    range_label: 'Classic',
    short_description: 'Classic muniya border in maroon and gold, woven since 1978.',
    description: 'A faithful reproduction of the first Paithani our family ever wove. Maroon katan silk with a muniya parcel border.',
    fabric: 'Pure Silk Katan',
    weave: 'Handloom',
    work: 'Muniya Border',
    care: 'Dry clean only.',
    dimensions: 'Saree 6.30 m, Blouse 0.80 m',
    price: 52000,
    stock: 5,
    images: ['/images/paithani-3.svg'],
    colors: ['Maroon', 'Black'],
    sizes: ['6.3 M with Blouse', '5.5 M without Blouse'],
    tags: ['classic', 'muniya'],
    is_best_seller: true,
  },
  {
    name: 'Peacock Blue Contemporary',
    collection_slug: 'contemporary-paithani',
    occasion: 'Party',
    range_label: 'Signature',
    short_description: 'Royal blue drape with a fine zari geometric border.',
    description: 'Lighter weight contemporary Paithani with a slim geometric border — made for receptions and cocktail evenings.',
    fabric: 'Pure Mulberry Silk',
    weave: 'Handloom',
    work: 'Zari Geometric Border',
    care: 'Dry clean only.',
    dimensions: 'Saree 6.30 m x 1.12 m',
    price: 42000,
    stock: 6,
    images: ['/images/paithani-4.svg'],
    colors: ['Royal Blue', 'Teal'],
    sizes: ['6.3 M with Blouse'],
    tags: ['contemporary', 'party', 'blue'],
    is_new_arrival: true,
    is_featured: true,
  },
  {
    name: 'Bridal Green Zari Pallu',
    collection_slug: 'sarees-by-color',
    occasion: 'Bridal',
    range_label: 'Heritage',
    short_description: 'Emerald green body with a deep gold zari pallu.',
    description: 'Emerald green silk paired with a densely woven gold pallu — the Maharashtrian bridal classic.',
    fabric: 'Pure Mulberry Silk',
    weave: 'Handloom',
    work: 'Gold Zari Pallu',
    care: 'Dry clean only.',
    dimensions: 'Saree 6.30 m, Blouse 0.85 m',
    price: 96000,
    stock: 1,
    images: ['/images/paithani-5.svg', '/images/paithani-2.svg'],
    colors: ['Emerald Green'],
    sizes: ['6.3 M with Blouse'],
    tags: ['green', 'bridal'],
    is_best_seller: true,
  },
  {
    name: 'Ivory Silk Paithani',
    collection_slug: 'contemporary-paithani',
    occasion: 'Gifting',
    range_label: 'Classic',
    short_description: 'Soft ivory drape with antique gold butis.',
    description: 'Understated ivory Paithani with antique gold butis — perfect for engagements and gifting.',
    fabric: 'Pure Mulberry Silk',
    weave: 'Handloom',
    work: 'Antique Zari Buti',
    care: 'Dry clean only.',
    dimensions: 'Saree 6.30 m, Blouse 0.80 m',
    price: 38000,
    stock: 0,
    images: ['/images/paithani-6.svg'],
    colors: ['Ivory', 'Champagne'],
    sizes: ['6.3 M with Blouse'],
    tags: ['ivory', 'gifting'],
    is_new_arrival: true,
  },
  {
    name: 'Maroon Maharani Paithani',
    collection_slug: 'bridal-collection',
    occasion: 'Bridal',
    range_label: 'Signature',
    short_description: 'Deep maroon with a diamond khan pallu and heavy zari.',
    description: 'Khan-pallu maroon Paithani with an intricate diamond lattice — six months on the loom.',
    fabric: 'Pure Mulberry Silk',
    weave: 'Handloom Kadiyal',
    work: 'Khan Pallu, Heavy Zari',
    care: 'Dry clean only.',
    dimensions: 'Saree 6.30 m x 1.20 m, Blouse 0.90 m',
    price: 175000,
    stock: 1,
    images: ['/images/paithani-2.svg', '/images/paithani-1.svg'],
    colors: ['Maroon', 'Deep Red'],
    sizes: ['6.3 M with Blouse'],
    tags: ['bridal', 'maharani', 'khan-pallu'],
    is_featured: true,
  },
  {
    name: 'Zari Kota Check Paithani',
    collection_slug: 'contemporary-paithani',
    occasion: 'Daily Wear',
    range_label: 'Classic',
    short_description: 'Lightweight half-silk Paithani with a zari check body.',
    description: 'Half-silk Paithani with a fine zari check — easy to drape, easy to wear through the day.',
    fabric: 'Half Silk',
    weave: 'Handloom',
    work: 'Zari Check',
    care: 'Gentle dry clean.',
    dimensions: 'Saree 6.30 m, Blouse 0.80 m',
    price: 18500,
    stock: 9,
    images: ['/images/paithani-3.svg'],
    colors: ['Mustard', 'Grey'],
    sizes: ['6.3 M with Blouse'],
    tags: ['daily', 'lightweight'],
    is_new_arrival: true,
  },
];

export async function seedDemoData() {
  const [existing] = await q('select count(*)::int as total from products');
  if ((existing?.total || 0) > 0) return { seeded: false };

  const collectionCount = await ensureCollections();

  for (const product of DEMO_PRODUCTS) {
    await createProduct(product);
  }

  await updateSettings({});
  const content = await ensureContent();
  return { seeded: true, products: DEMO_PRODUCTS.length, collections: collectionCount, ...content };
}

export async function ensureCollections() {
  const rows = await q('select slug from collections');
  const known = new Set(rows.map((row) => row.slug));
  for (const collection of COLLECTIONS) {
    const slug = slugify(collection.name);
    if (known.has(slug)) continue;
    await q(
      `insert into collections (id, slug, name, tagline, description, image_url, sort_order, is_active)
       values ($1,$2,$3,$4,$5,$6,$7,true)`,
      [newId(), slug, collection.name, collection.tagline, collection.description, collection.image_url, collection.sort_order],
    );
  }
  const [count] = await q('select count(*)::int as total from collections');
  return count?.total || 0;
}

export const LEGACY_STORIES = [
  {
    celebrity_name: 'Meera Ranade',
    title: 'Actor · Marathi stage & cinema',
    review:
      'I wore the peacock munni for our anniversary shoot and it moved like liquid gold. The zari catches every light on stage.',
    image_url: '/images/paithani-1.svg',
    sort_order: 1,
  },
  {
    celebrity_name: 'Ananya Pradhan',
    title: 'Classical dancer',
    review:
      'My guruji gifted me a Yeola Paithani at my arangetram. Twenty years on, it is still the saree I reach for on every big day.',
    image_url: '/images/paithani-2.svg',
    sort_order: 2,
  },
  {
    celebrity_name: 'Kavya Deshmukh',
    title: 'Television presenter',
    review:
      'The lotus buti bridal drape was made to my colour pairing. It is the most photographed thing I own.',
    image_url: '/images/paithani-5.svg',
    sort_order: 3,
  },
];

export const EXHIBITIONS = [
  {
    title: 'Yeola Handloom Utsav',
    location: 'Yeola, Nashik',
    event_date: 'February 2026',
    description:
      'Ten days on the loom-front at the town that gave Paithani its name — live weaving, zari tests and a bridal trousseau corner.',
    images: ['/images/paithani-1.svg', '/images/paithani-3.svg'],
    sort_order: 1,
  },
  {
    title: 'Maharashtra Heritage Expo',
    location: 'Pune',
    event_date: 'November 2025',
    description:
      'Our family loom archive alongside commissioned bridal Paithanis, with a lecture-demonstration on kadiyal weaving.',
    images: ['/images/paithani-2.svg', '/images/paithani-4.svg'],
    sort_order: 2,
  },
  {
    title: 'Silk Mark Pop-up',
    location: 'Mumbai',
    event_date: 'August 2025',
    description: 'A weekend pop-up of signature sarees and brocade accessories, with on-site draping sessions.',
    images: ['/images/paithani-6.svg', '/images/paithani-5.svg'],
    sort_order: 3,
  },
];

/**
 * Seeds the two editorial sections once, so a fresh install shows a populated
 * "Our Legacy" and "Exhibitions" page. Everything here is editable from the
 * dashboard — these are only starting points.
 */
export async function ensureContent() {
  const [{ total: legacyCount }] = await q('select count(*)::int as total from legacy_reviews');
  if (!legacyCount) {
    for (const entry of LEGACY_STORIES) {
      await q(
        `insert into legacy_reviews (id, celebrity_name, title, review, image_url, sort_order, is_active)
         values ($1,$2,$3,$4,$5,$6,true)`,
        [newId(), entry.celebrity_name, entry.title, entry.review, entry.image_url, entry.sort_order],
      );
    }
  }
  const [{ total: exhibitionCount }] = await q('select count(*)::int as total from exhibitions');
  if (!exhibitionCount) {
    for (const entry of EXHIBITIONS) {
      await q(
        `insert into exhibitions (id, title, location, event_date, description, images, sort_order, is_active)
         values ($1,$2,$3,$4,$5,$6,$7,true)`,
        [newId(), entry.title, entry.location, entry.event_date, entry.description, JSON.stringify(entry.images), entry.sort_order],
      );
    }
  }
  return { legacy: legacyCount ? 0 : LEGACY_STORIES.length, exhibitions: exhibitionCount ? 0 : EXHIBITIONS.length };
}

export async function databaseSummary() {
  const rows = await q("select count(*)::int as products from products where is_deleted = false");
  const collections = await one('select count(*)::int as total from collections');
  return { products: rows[0]?.products || 0, collections: collections?.total || 0 };
}
