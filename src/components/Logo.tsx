import { Link } from 'react-router-dom';

/**
 * The official Sonali Handlooms monogram — a gold peacock drawn as an "S" whose
 * tail is the pallu of a saree. It ships as a transparent PNG, so the header,
 * hero, footer, drawer and admin share one asset and the metallic gold gradient
 * stays intact instead of being flattened into a single ink colour.
 */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <img
      src="/images/logo-mark.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="logo__mark"
    />
  );
}

export function Logo({ to = '/', compact = false }: { to?: string; compact?: boolean }) {
  return (
    <Link to={to} className="logo" aria-label="Sonali Handlooms home">
      <LogoMark size={compact ? 26 : 34} />
      <span className="logo__word">Sonali</span>
      {!compact && <span className="logo__sub">Handlooms</span>}
    </Link>
  );
}
