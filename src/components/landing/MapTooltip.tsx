'use client';

import { useState } from 'react';

type Tip = { text: string; x: number; y: number };

// Wraps the server-rendered SVG. Without JavaScript the map still renders; this only adds the tooltip.
// Covered states carry data-tip and are keyboard focusable.
export function MapTooltip({ children }: { children: React.ReactNode }) {
  const [tip, setTip] = useState<Tip | null>(null);

  function show(target: EventTarget, container: HTMLElement, pointer?: { x: number; y: number }) {
    const el = (target as Element).closest?.('[data-tip]');
    if (!el) return setTip(null);
    const box = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setTip({
      text: el.getAttribute('data-tip') ?? '',
      x: (pointer?.x ?? r.left + r.width / 2) - box.left,
      y: (pointer?.y ?? r.top) - box.top,
    });
  }

  return (
    <div
      className="relative"
      onMouseMove={(e) => show(e.target, e.currentTarget, { x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setTip(null)}
      onFocus={(e) => show(e.target, e.currentTarget)}
      onBlur={() => setTip(null)}
      onKeyDown={(e) => e.key === 'Escape' && setTip(null)}
    >
      {children}
      {tip && (
        <div
          aria-hidden="true"
          style={{ left: tip.x, top: tip.y }}
          className="pointer-events-none absolute z-10 w-max max-w-[16rem] -translate-x-1/2 -translate-y-full rounded-md bg-navy px-3 py-2 text-sm font-semibold text-white shadow-lg"
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}
