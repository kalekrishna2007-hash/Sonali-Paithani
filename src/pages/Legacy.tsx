import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';

/**
 * "Our Legacy" — the people who have worn a Sonali Paithani and what they said
 * about it. Every entry (photo, name, review) is published from the dashboard.
 */
export function Legacy() {
  const { data, loading } = useAsync(() => api.legacy(), []);
  const stories = data?.legacy || [];

  return (
    <>
      <section className="section section--ivory">
        <div className="container heritage center">
          <span className="eyebrow">Our Legacy</span>
          <h1 style={{ marginTop: '0.4rem' }}>Worn by the people we admire</h1>
          <div className="divider-gold divider-gold--center" />
          <p className="muted" style={{ maxWidth: '46rem', marginInline: 'auto' }}>
            From the stage to the silver screen, these are the personalities who chose a Saree by Sonali Paithani for
            their most photographed days — and what they told us afterwards.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          {loading ? (
            <div className="legacy-grid">
              {[0, 1, 2].map((key) => (
                <div className="skeleton" style={{ height: '320px' }} key={key} />
              ))}
            </div>
          ) : stories.length ? (
            <div className="legacy-grid">
              {stories.map((story) => (
                <article className="legacy-card" key={story.id}>
                  <div className="legacy-card__media">
                    <img src={story.image_url || '/images/paithani-1.svg'} alt={story.celebrity_name} loading="lazy" />
                  </div>
                  <div className="legacy-card__body">
                    <span className="legacy-card__mark" aria-hidden>
                      &ldquo;
                    </span>
                    {story.review && <p className="legacy-card__quote">{story.review}</p>}
                    <div>
                      <div className="legacy-card__name">{story.celebrity_name}</div>
                      {story.title && <div className="legacy-card__role">{story.title}</div>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              <h3>Our legacy gallery is being updated</h3>
              <p className="muted">New photographs and reviews are on their way. Meanwhile, explore the collection.</p>
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
              share the story of your day here.
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
