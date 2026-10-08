'use client';

import { useId } from 'react';

export type Pill<T extends string> = { value: T; label: string; extra?: React.ReactNode };

export function RadioPills<T extends string>({
  legend,
  value,
  onChange,
  options,
  stacked,
}: {
  legend: string;
  value: T | null;
  onChange: (v: T) => void;
  options: Pill<T>[];
  stacked?: boolean;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-muted">{legend}</legend>
      <div className={`mt-2 flex gap-2 ${stacked ? 'flex-col' : 'flex-wrap'}`}>
        {options.map((o) => (
          <label key={o.value} className="block cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span className="block rounded-lg border-2 border-black/15 px-4 py-3 font-semibold peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-amber">
              {o.label}
            </span>
            {o.extra}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
