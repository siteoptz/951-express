'use client';

import { useId, useMemo, useRef, useState } from 'react';

export type Option = { value: string; label: string };

// A type-to-search select (ARIA combobox with a listbox). Free text is allowed: the typed value is kept
// when it does not match an option, because the vehicle lists are never complete.
export function Combobox({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  hint,
  loading,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
  loading?: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const shown = text ?? options.find((o) => o.value === value)?.label ?? value;
  const filtered = useMemo(() => {
    const q = (text ?? '').trim().toLowerCase();
    const list = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    return list.slice(0, 60);
  }, [options, text]);

  function commit(next: string) {
    onChange(next);
    setText(null);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      const o = filtered[active];
      if (o) commit(o.value);
      else if (text !== null) commit(text.trim());
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setText(null);
    }
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="block text-sm font-semibold text-muted">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        disabled={disabled}
        value={shown}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Keep what the customer typed, matched to a list entry when it is one.
          if (text !== null) {
            const t = text.trim();
            const match = options.find((o) => o.label.toLowerCase() === t.toLowerCase());
            commit(match ? match.value : t);
          }
          setOpen(false);
        }}
        onKeyDown={onKeyDown}
        className="mt-1 w-full rounded-lg border-2 border-black/15 px-4 py-3 text-base focus:border-navy disabled:bg-soft disabled:text-muted"
      />
      {hint && <p className="mt-1 text-sm text-muted">{loading ? '' : hint}</p>}
      {open && filtered.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-black/15 bg-white py-1 shadow-lg"
        >
          {filtered.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown keeps focus in the input so blur does not close the list first
              onMouseDown={(e) => {
                e.preventDefault();
                commit(o.value);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-4 py-2 ${i === active ? 'bg-soft font-semibold' : ''}`}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
