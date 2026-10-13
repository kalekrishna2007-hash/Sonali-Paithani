import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useApp } from '../lib/store';
import { whatsappChatUrl } from '../lib/format';
import { Hero } from '../components/Hero';
import { MediaWall } from '../components/MediaGallery';
import { ProductCard } from '../components/ProductCard';
import { DiamondIcon, LoomIcon, SunIcon, TruckIcon, WhatsAppIcon } from '../components/icons';

const TRUST = [
  { icon: <SunIcon size={22} />, title: '100% Handwoven', sub: 'Authentic Paithani' },
  { icon: <DiamondIcon size={22} />, title: 'Pure Silk', sub: 'Finest quality' },
  { icon: <LoomIcon size={22} />, title: 'Heritage Craft', sub: 'Generations of expertise' },
  { icon: <TruckIcon size={22} />, title: 'Secure Delivery', sub: 'Across India & worldwide' },
];

function ProductRail({ title, subtitle, params, cta }: { title: string; subtitle: string; params: Record<string, unknown>; cta: string }) {
  const { data, loading } = useAsync(() => api.products({ limit: 4, ...params }), [JSON.stringify(params)]);

  return (
    <section className="section">
      <div className="container">
        <div className="row row--between row--wrap" style={{ marginBottom: '1.6rem' }}>
          <div>
            <span className="eyebrow">{subtitle}</span>
            <h2 style={{ margin: '0.3rem 0 0' }}>{title}</h2>
          </div>
          <Link className="btn btn--outline btn--sm" to={`/shop?${new URLSearchParams(params as Record<string, string>).toString()}`}>
            {cta}
          </Link>
        </div>

        {loading ? (
          <div className="product-grid">
            {[0, 1, 2, 3].map((key) => (
              <div className="skeleton skeleton--card" key={key} />
            ))}
          </div>
        ) : (
          <div className="product-grid">
            {(data?.rows || []).map((product) => (
              <ProductCard key={product.id} product={product} flag={params.new_arrival ? 'New' : undefined} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * A preview of one of the two media galleries (Our Legacy, Exhibitions): the
 * first few tiles of the same wall its own page shows, with a link across.
 * Nothing published yet means no section at all — an empty grid on the home
 * page reads as a broken page rather than as "nothing here yet".
 */
function GalleryRail({
  subtitle,
  title,
  blurb,
  tone,
  entries,
  loading,
  href,
  cta,
}: {
  subtitle: string;
  title: string;
  blurb: string;
  tone: 'cream' | 'plain';
  entries: { id: string; media: string[] }[];
  loading: boolean;
  href: string;
  cta: string;
}) {
  if (!loading && !entries.length) return null;

  return (
    <section className={`section${tone === 'cream' ? ' section--cream' : ''}`}>
      <div className="container">
        <div className="row row--between row--wrap" style={{ marginBottom: '1.6rem' }}>
          <div>
            <span className="eyebrow">{subtitle}</span>
            <h2 style={{ margin: '0.3rem 0 0' }}>{title}</h2>
            <p className="muted" style={{ maxWidth: '46rem' }}>
              {blurb}
            </p>
          </div>
          <Link className="btn btn--outline btn--sm" to={href}>
            {cta}
          </Link>
        </div>

        {loading ? (
          <div className="media-wall">
            {[0, 1, 2, 3, 4, 5].map((key) => (
              <div className="skeleton media-wall__tile" key={key} />
            ))}
          </div>
        ) : (
          <MediaWall entries={entries} limit={6} />
        )}
      </div>
    </section>
  );
}

function LegacyRail() {
  const { data, loading } = useAsync(() => api.legacy(), []);
  return (
    <GalleryRail
      subtitle="Our Legacy"
      title="Worn by the people we admire"
      blurb="From the stage to the silver screen — moments with the personalities who chose a saree by Sonali Paithani for their most photographed days."
      tone="cream"
      entries={data?.legacy || []}
      loading={loading}
      href="/legacy"
      cta="See the whole gallery"
    />
  );
}

function ExhibitionsRail() {
  const { data, loading } = useAsync(() => api.exhibitions(), []);
  return (
    <GalleryRail
      subtitle="Exhibitions"
      title="Where our looms have travelled"
      blurb="Handloom utsavs, heritage expos and city pop-ups — photographs and clips from the stalls where visitors could feel the zari and meet the weavers behind every drape."
      tone="plain"
      entries={data?.exhibitions || []}
      loading={loading}
      href="/exhibitions"
      cta="See every exhibition"
    />
  );
}

export function Home() {
  const { settings } = useApp();
  const { data: collectionData } = useAsync(() => api.collections(), []);

  return (
    <>
      <Hero />

      <section className="section section--ivory">
        <div className="container heritage center">
          <span className="eyebrow">✳ Yeola &amp; Paithan heritage handlooms since 1978 ✳</span>
          <h2 style={{ marginTop: '0.6rem' }}>Where centuries of royalty are woven into every thread</h2>
          <div className="divider-gold divider-gold--center" />
          <p className="heritage__quote">
            “पैठणी म्हणजे केवळ साडी नव्हे, तर पिढ्यानपिढ्यांचा शाही वारसा”
          </p>
          <p className="muted" style={{ maxWidth: '44rem', marginInline: 'auto' }}>
            Pure 3-ply Mulberry Katan Silk, hand-interlocked on pit looms over 45 to 180 days with certified tested gold
            and silver zari. Authentic. Elegant. Global.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0, marginTop: '-1px' }}>
        <div className="container">
          <div className="trust">
            {TRUST.map((item) => (
              <div className="trust__item" key={item.title}>
                <span className="trust__icon">{item.icon}</span>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--cream">
        <div className="container">
          <span className="eyebrow">Explore</span>
          <h2 style={{ marginTop: '0.3rem' }}>Shop by Collection</h2>
          <p className="muted" style={{ maxWidth: '46rem' }}>
            From timeless classics to bridal heirlooms, find an authentic Paithani for every royal celebration.
          </p>

          <div className="collection-grid" style={{ marginTop: '1.8rem' }}>
            {(collectionData?.collections || []).slice(0, 4).map((collection) => (
              <Link className="collection-card" key={collection.id} to={`/shop?collection=${collection.slug}`}>
                <img src={collection.image_url || '/images/paithani-1.svg'} alt={collection.name} loading="lazy" />
                <span className="collection-card__veil" />
                <div className="collection-card__body">
                  <div>
                    <h3>{collection.name}</h3>
                    <span>{collection.tagline || `${collection.product_count} pieces`}</span>
                  </div>
                  <span className="collection-card__arrow">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <ProductRail title="Best Sellers" subtitle="Loved by our customers" params={{ best_seller: true }} cta="View all best sellers" />

      <section className="section section--cream">
        <div className="container">
          <div className="center">
            <span className="eyebrow">How it works</span>
            <h2 style={{ marginTop: '0.3rem' }}>Enquire, approve, receive on WhatsApp</h2>
            <p className="muted" style={{ maxWidth: '44rem', marginInline: 'auto' }}>
              Every Paithani is a considered purchase. Send us an enquiry for the exact saree you love — our studio
              confirms availability and price, and your approval plus payment details arrive on WhatsApp.
            </p>
          </div>

          <div className="steps" style={{ marginTop: '2rem' }}>
            <div className="step">
              <span className="step__no">01</span>
              <h3>Enquire about a saree</h3>
              <p className="muted">
                Open the saree you love and tap Enquire — your enquiry carries that exact piece, with your size, colour
                and the date you need it by. No payment needed at this step.
              </p>
            </div>
            <div className="step">
              <span className="step__no">02</span>
              <h3>Our studio confirms</h3>
              <p className="muted">
                We check the loom, confirm the final price and the advance amount for your piece, and approve your
                request from our dashboard.
              </p>
            </div>
            <div className="step">
              <span className="step__no">03</span>
              <h3>WhatsApp with payment details</h3>
              <p className="muted">
                Your approval, order summary and payment details (UPI and bank) land on your WhatsApp instantly. Share
                the screenshot and we start weaving.
              </p>
            </div>
          </div>
        </div>
      </section>

      <ProductRail title="New Arrivals" subtitle="Fresh off the loom" params={{ new_arrival: true }} cta="View new arrivals" />

      <LegacyRail />

      <ExhibitionsRail />

      <section className="band">
        <div className="container band__inner">
          <div>
            <span className="eyebrow" style={{ color: 'var(--gold-soft)' }}>Personal consultation</span>
            <h2>Not sure which Paithani suits your occasion?</h2>              <p>
                Send us your occasion and budget on WhatsApp — our studio replies with a curated video of available
                pieces from Yeola, usually within a few hours. Or browse the collection and enquire about any saree
                that catches your eye.
              </p>
          </div>
          <a
            className="btn btn--gold"
            href={whatsappChatUrl(settings?.store_whatsapp || '919822055443', 'Namaskar! Please help me choose a Paithani for my occasion.')}
            target="_blank"
            rel="noreferrer"
          >
            <WhatsAppIcon size={17} /> Chat on WhatsApp
          </a>
        </div>
      </section>
    </>
  );
}
