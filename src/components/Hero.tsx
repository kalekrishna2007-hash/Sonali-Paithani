import { Link } from 'react-router-dom';
import { LogoMark } from './Logo';

const TAGS = ['Heritage', 'Handloom', 'Pure Silk', 'Forever'];
const RAIL = ['Tradition', 'Culture', 'Elegance', 'You'];

/** Line — diamond — line flourish, used under the lockup and around the side rail. */
function Ornament() {
  return (
    <span className="ornament" aria-hidden="true">
      <i />
    </span>
  );
}

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <picture className="hero__art">
        <source media="(max-width: 720px)" srcSet="/images/hero-loom-mobile.jpg" />
        <img
          src="/images/hero-loom.jpg"
          alt="Handwoven maroon and gold Paithani saree with peacock and vine zari motifs draped over a carved rosewood chair in a warmly lit Maharashtrian room"
        />
      </picture>
      <span className="hero__scrim" aria-hidden="true" />

      <div className="container hero__inner">
        <div className="hero__col">
          {/* The lockup is centred over the headline block, so both live in a
              shrink-to-fit wrapper: its width is the longest headline line. */}
          <div className="hero__masthead">
            <div className="hero__lockup">
              <LogoMark size={46} />
              <strong>Handlooms</strong>
              <span className="hero__tagline">A legacy in every weave</span>
              <Ornament />
            </div>

            <h1 id="hero-title">
              Timeless
              <br />
              Tradition
              <br />
              In Every Thread
            </h1>
          </div>

          <p className="hero__sub">
            Handwoven Paithani Sarees from Maharashtra
            <br />
            A Heritage Worn for Generations
          </p>

          <Link className="btn btn--hero" to="/shop">
            Explore Collection <span aria-hidden="true">→</span>
          </Link>

          <ul className="hero__tags">
            {TAGS.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        </div>
      </div>

      <aside className="hero__rail" aria-hidden="true">
        <Ornament />
        <ul>
          {RAIL.map((word) => (
            <li key={word}>{word}</li>
          ))}
        </ul>
        <Ornament />
      </aside>
    </section>
  );
}
