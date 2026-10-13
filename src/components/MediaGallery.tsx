import type { CSSProperties } from 'react';
import { isVideoUrl } from '../lib/media';

type TileProps = { url: string; className?: string; style?: CSSProperties };

/**
 * A photo or a video on the storefront. Videos carry controls so they can be
 * played in place — on phones that opens the usual inline player.
 */
export function MediaItem({ url, className, style }: TileProps) {
  if (isVideoUrl(url)) {
    return (
      <video className={className} style={style} src={url} controls playsInline preload="metadata" />
    );
  }
  return <img className={className} style={style} src={url} alt="" loading="lazy" />;
}

/** The same tile without controls, for previews inside the dashboard. */
export function MediaThumb({ url, className, style }: TileProps) {
  if (isVideoUrl(url)) {
    return (
      <video className={className} style={style} src={url} muted playsInline preload="metadata" />
    );
  }
  return <img className={className} style={style} src={url} alt="" loading="lazy" />;
}

/**
 * The wall both gallery pages show: every photo and video of every published
 * set, in dashboard order, with no captions of any kind. `limit` shows only the
 * first tiles, which is what the storefront home page previews.
 */
export function MediaWall({ entries, limit }: { entries: { id: string; media: string[] }[]; limit?: number }) {
  const tiles = entries.flatMap((entry) =>
    entry.media.map((url, index) => ({ key: `${entry.id}-${index}`, url })),
  );
  const shown = limit ? tiles.slice(0, limit) : tiles;

  return (
    <div className="media-wall">
      {shown.map((tile) => (
        <figure className="media-wall__tile" key={tile.key}>
          <MediaItem url={tile.url} className="media-wall__media" />
        </figure>
      ))}
    </div>
  );
}
