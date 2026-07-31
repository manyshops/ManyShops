type LogoVariant = 'full' | 'mark';

type Props = {
  variant?: LogoVariant;
  className?: string;
  priority?: boolean;
  /**
   * Set on dark surfaces. The supplied artwork has an opaque white background
   * baked into its embedded bitmaps, so it cannot be knocked out — instead it
   * is presented on a white plate, which reads as a deliberate brand lockup.
   */
  plate?: boolean;
};

/**
 * Renders /public/logo.svg — the supplied brand asset, unmodified.
 *
 * The source artwork sits inside a 1500x1500 canvas with decorative whitespace
 * around it, which reads as a floating logo in a header. Rather than editing the
 * brand file we crop to the artwork with a CSS viewport: the wrapper's aspect
 * ratio defines the visible window, and the image is scaled and offset by
 * percentages of its own box so the crop holds at every size.
 */
/**
 * Measured from the file: the mark occupies (88,503)-(558,925) and the
 * wordmark (571,695)-(1286,830), with everything else in the canvas being
 * faint decorative filler. Each crop adds a 10-unit margin on all sides.
 */
const CROPS: Record<LogoVariant, { x: number; y: number; w: number; h: number }> = {
  // Bag + route + "Manyshops" wordmark.
  full: { x: 78, y: 493, w: 1218, h: 442 },
  // Bag and pins only, for square contexts.
  mark: { x: 78, y: 493, w: 490, h: 442 }
};

const CANVAS = 1500;

export function Logo({
  variant = 'full',
  className,
  priority = false,
  plate = false
}: Props) {
  const crop = CROPS[variant];
  const scale = CANVAS / crop.w;

  const image = (
    <span
      className={plate ? undefined : className}
      style={{
        display: 'block',
        position: 'relative',
        overflow: 'hidden',
        aspectRatio: `${crop.w} / ${crop.h}`,
        // The logo is a fixed composition; never mirror it in RTL.
        direction: 'ltr'
      }}
    >
      <img
        src="/logo.svg"
        alt="ManyShops"
        width={crop.w}
        height={crop.h}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${scale * 100}%`,
          height: 'auto',
          maxWidth: 'none',
          transform: `translate(${(-crop.x / CANVAS) * 100}%, ${(-crop.y / CANVAS) * 100}%)`
        }}
      />
    </span>
  );

  if (!plate) return image;

  return (
    <span
      className={`inline-block rounded-2xl bg-white px-3 py-2.5 shadow-lg shadow-navy-950/25 ${className ?? ''}`}
    >
      {image}
    </span>
  );
}
