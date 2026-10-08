'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { landing } from '@/content/landing';
import { Section } from '@/components/ui/Section';
import { SectionHeading } from '@/components/ui/SectionHeading';

export function Gallery() {
  const g = landing.gallery;
  const [index, setIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const count = g.items.length;

  const step = useCallback(
    (d: number) => setIndex((i) => (i === null ? i : (i + d + count) % count)),
    [count],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (index !== null && !dialog.open) dialog.showModal();
    if (index === null && dialog.open) dialog.close();
  }, [index]);

  const current = index === null ? null : g.items[index];

  return (
    <Section id="gallery">
      <SectionHeading title={g.heading} intro={g.intro} />
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {g.items.map((item, i) => (
          <li key={item.src}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Enlarge photo: ${item.alt}`}
              className="block w-full overflow-hidden rounded-xl"
            >
              <Image
                src={item.src}
                alt={item.alt}
                width={item.width}
                height={item.height}
                sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                className="aspect-[4/3] w-full object-cover transition-transform hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-label="Photo viewer"
        onClose={() => setIndex(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setIndex(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') step(-1);
          if (e.key === 'ArrowRight') step(1);
        }}
        className="m-auto max-h-[92vh] max-w-[min(94vw,1100px)] rounded-xl bg-navy p-3 text-white"
      >
        {current && (
          <div>
            <Image
              src={current.src}
              alt={current.alt}
              width={current.width}
              height={current.height}
              sizes="94vw"
              className="max-h-[78vh] w-auto rounded-lg object-contain"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => step(-1)}
                className="rounded px-4 py-2 font-semibold hover:bg-white/10"
              >
                ← Prev
              </button>
              <button
                type="button"
                onClick={() => setIndex(null)}
                className="rounded px-4 py-2 font-semibold hover:bg-white/10"
              >
                Close (Esc)
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                className="rounded px-4 py-2 font-semibold hover:bg-white/10"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </dialog>
    </Section>
  );
}
