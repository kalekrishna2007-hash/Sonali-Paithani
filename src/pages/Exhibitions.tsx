import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';

/**
 * "Exhibitions" — the shows, expos and pop-ups where the studio has shown its
 * Paithanis. Titles, locations, write-ups and photographs come from the dashboard.
 */
export function Exhibitions() {
  const { data, loading } = useAsync(() => api.exhibitions(), []);
  const shows = data?.exhibitions || [];

  return (
    <>
      <section className="section section--ivory">
        <div className="container heritage center">
          <span className="eyebrow">Exhibitions</span>
          <h1 style={{ marginTop: '0.4rem' }}>Where our looms have travelled</h1>
          <div className="divider-gold divider-gold--center" />
          <p className="muted" style={{ maxWidth: '46rem', marginInline: 'auto' }}>
            Handloom utsavs, heritage expos and city pop-ups — a look back at the exhibitions where visitors could feel
            the zari and meet the weavers behind every drape.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          {loading ? (
            <div className="expo">
              {[0, 1].map((key) => (
                <div className="skeleton" style={{ height: '300px' }} key={key} />
              ))}
            </div>
          ) : shows.length ? (
            <div className="expo">
              {shows.map((show) => (
                <article className="expo-card" key={show.id}>
                  <div className="expo-card__gallery">
                    {(show.images.length ? show.images : ['/images/paithani-1.svg']).slice(0, 3).map((image, index) => (
                      <img key={`${show.id}-${index}`} src={image} alt={`${show.title} — photo ${index + 1}`} loading="lazy" />
                    ))}
                  </div>
                  <div className="expo-card__body">
                    <span className="eyebrow">Exhibition</span>
                    <h2 style={{ margin: '0.2rem 0 0' }}>{show.title}</h2>
                    <div className="expo-card__meta">
                      {show.location && <span>{show.location}</span>}
                      {show.event_date && <span>{show.event_date}</span>}
                    </div>
                    {show.description && <p className="muted" style={{ margin: 0 }}>{show.description}</p>}
                  </div>
                </article>
              ))}
            </div>
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
