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
 * set, in dashboard order, with no captions of any kind.
 */
export function MediaWall({ entries }: { entries: { id: string; media: string[] }[] }) {
  const tiles = entries.flatMap((entry) =>
    entry.media.map((url, index) => ({ key: `${entry.id}-${index}`, url })),
  );

  return (
    <div className="media-wall">
      {tiles.map((tile) => (
        <figure className="media-wall__tile" key={tile.key}>
          <MediaItem url={tile.url} className="media-wall__media" />
        </figure>
      ))}
    </div>
  );
}
