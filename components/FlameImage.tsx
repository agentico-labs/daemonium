import type { CSSProperties } from 'react';

/**
 * The one shared flame webp, recolored per element via the `filter` the caller passes
 * in `style`. Every dæmon in the cluster — and the seed flame in the summon sheet — is
 * this same image hue-rotated, so it loads once and the browser caches it. Decorative
 * (aria-hidden); the eslint-disable mirrors components/Flame.tsx (the art is fixed-size
 * and filtered, so next/image buys nothing here).
 */
const FLAME_SRC = '/daemon/idle/full.webp';

export function FlameImage({
  style,
  className = 'absolute inset-0 h-full w-full object-contain',
}: {
  style?: CSSProperties;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={FLAME_SRC}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      className={className}
      style={style}
    />
  );
}
