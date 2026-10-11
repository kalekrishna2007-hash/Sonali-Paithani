import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { MediaWall } from '../components/MediaGallery';

/**
 * "Our Legacy" — photos and video clips of personalities wearing a Sonali
 * Paithani. Media only: no name, role or quote is published, here or in the
 * dashboard that feeds it.
 */
export function Legacy() {
  const { data, loading } = useAsync(() => api.legacy(), []);
  const sets = data?.legacy || [];

  return (
    <>
      <section className="section section--ivory">
        <div className="container heritage center">
          <span className="eyebrow">Our Legacy</span>
          <h1 style={{ marginTop: '0.4rem' }}>Worn by the people we admire</h1>
          <div className="divider-gold divider-gold--center" />
          <p className="muted" style={{ maxWidth: '46rem', marginInline: 'auto' }}>
            From the stage to the silver screen — moments with the personalities who chose a saree by Sonali Paithani
            for their most photographed days.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          {loading ? (
            <div className="media-wall">
              {[0, 1, 2, 3].map((key) => (
                <div className="skeleton media-wall__tile" key={key} />
              ))}
            </div>
          ) : sets.length ? (
            <MediaWall entries={sets} />
          ) : (
            <div className="empty">
              <h3>Our legacy gallery is being updated</h3>
              <p className="muted">New photographs and clips are on their way. Meanwhile, explore the collection.</p>
              <Link className="btn" to="/shop">
                Explore the collection
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="band">
        <div className="container band__inner">
          <div>
            <span className="eyebrow" style={{ color: 'var(--gold-soft)' }}>
              Be part of it
            </span>
            <h2>Wearing a Sonali Paithani for your big day?</h2>
            <p>
              Send us your occasion on WhatsApp and our studio will help you choose the drape — and we would love to
              feature your photographs here.
            </p>
          </div>
          <Link className="btn btn--gold" to="/shop">
            Find your Paithani
          </Link>
        </div>
      </section>
    </>
  );
}
