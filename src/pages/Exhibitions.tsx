import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { MediaWall } from '../components/MediaGallery';

/**
 * "Exhibitions" — photos and video clips from the shows, expos and pop-ups the
 * studio has taken part in. Media only: no titles, places or write-ups.
 */
export function Exhibitions() {
  const { data, loading } = useAsync(() => api.exhibitions(), []);
  const sets = data?.exhibitions || [];

  return (
    <>
      <section className="section section--ivory">
        <div className="container heritage center">
          <span className="eyebrow">Exhibitions</span>
          <h1 style={{ marginTop: '0.4rem' }}>Where our looms have travelled</h1>
          <div className="divider-gold divider-gold--center" />
          <p className="muted" style={{ maxWidth: '46rem', marginInline: 'auto' }}>
            Handloom utsavs, heritage expos and city pop-ups — photographs and clips from the stalls where visitors
            could feel the zari and meet the weavers behind every drape.
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
              <h3>No exhibitions to show yet</h3>
              <p className="muted">Our next showcase will be listed here. In the meantime, browse the collection.</p>
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
              Invite us
            </span>
            <h2>Hosting an exhibition or wedding fair?</h2>
            <p>
              We travel with a curated trunk of signature and made-to-order Paithanis, and run live draping sessions at
              the stall. Tell us about your event on WhatsApp.
            </p>
          </div>
          <Link className="btn btn--gold" to="/shop">
            See what we weave
          </Link>
        </div>
      </section>
    </>
  );
}
