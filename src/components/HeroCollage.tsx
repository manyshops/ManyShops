'use client';

import gsap from 'gsap';
import { useEffect, useRef } from 'react';

/**
 * The geometric backdrop behind the quote card.
 *
 * Colour blocks anchored to the corners, a dashed route arcing between them,
 * and a floating brand tile — the same composition language as the reference
 * layout, rebuilt in the ManyShops palette. The route line is the piece that
 * actually means something here: it is the Turkey-to-Lebanon leg already drawn
 * in the logo, enlarged.
 */
export function HeroCollage() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const context = gsap.context(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set('.collage-shape, .collage-tile', { opacity: 1, scale: 1 });
        return;
      }

      gsap
        .timeline({ delay: 0.25 })
        .fromTo(
          '.collage-shape',
          { opacity: 0, scale: 0.82 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.8,
            stagger: 0.09,
            ease: 'back.out(1.4)'
          }
        )
        .fromTo(
          '.collage-tile',
          { opacity: 0, y: 24, scale: 0.9 },
          { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'back.out(1.6)' },
          '-=0.5'
        );

      // Dashes travel along the route rather than drawing in once, so the
      // parcel's journey reads as ongoing. A dashed stroke cannot use the usual
      // draw-on trick anyway — the offset would slide the pattern, not reveal it.
      gsap.to('.collage-route', {
        strokeDashoffset: -160,
        duration: 6,
        repeat: -1,
        ease: 'none'
      });

      // Slow drift keeps the composition from feeling like a flat screenshot.
      gsap.to('.collage-float-a', {
        y: -14,
        duration: 5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });
      gsap.to('.collage-float-b', {
        y: 12,
        duration: 6.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });
    }, root);

    return () => context.revert();
  }, []);

  return (
    <div ref={root} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* Navy block, breaking past the card's top-left corner. */}
      <span className="collage-shape collage-float-a absolute start-[0%] top-[2%] h-[34%] w-[30%] rounded-[2rem] rounded-br-[6rem] bg-navy-900 opacity-0" />

      {/* Amber quarter-circle, top-right. */}
      <span className="collage-shape absolute end-[1%] top-[1%] size-[22%] rounded-bl-full bg-amber-400 opacity-0" />

      {/* Teal quarter-circle tucked beneath it. */}
      <span className="collage-shape collage-float-b absolute end-[0%] top-[30%] size-[24%] rounded-tr-full rounded-bl-full bg-teal-500 opacity-0" />

      {/* Pale wedge, lower-left — the flat plane in the reference. */}
      <span
        className="collage-shape absolute start-[0%] bottom-[6%] h-[30%] w-[26%] bg-teal-300/60 opacity-0"
        style={{ clipPath: 'polygon(0 100%, 0 0, 100% 100%)' }}
      />

      {/* Coral disc, bottom-right, echoing the Lebanon pin. */}
      <span className="collage-shape collage-float-a absolute end-[6%] bottom-[0%] size-[16%] rounded-full bg-coral-500/90 opacity-0" />

      {/* The route: Turkey to Lebanon, the same arc as the logo. */}
      <svg
        viewBox="0 0 400 400"
        fill="none"
        className="absolute inset-0 size-full text-navy-700/35"
        preserveAspectRatio="none"
      >
        <path
          className="collage-route"
          d="M40 300 C 120 340, 190 250, 210 170 S 300 40, 372 76"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="7 9"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
