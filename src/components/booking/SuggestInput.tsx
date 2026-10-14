'use client';

import { useId, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { passwordManagerOffAttrs } from '@/lib/zip-input';

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'role' | 'autoComplete' | 'aria-controls' | 'aria-expanded'
> & {
  value: string;
  onChange: (value: string) => void;
  /** Already ranked and capped by the caller. */
  suggestions: string[];
  /** Spoken to screen readers when the list opens: "{n}" is the number of suggestions. */
  countLabel?: string;
};

/**
 * A plain text box with an optional type-ahead list (the ARIA combobox pattern). Typing anything is always
 * allowed. Arrow keys move through the list, Enter picks the highlighted one, Escape closes it, and Tab or
 * clicking away keeps exactly what was typed. The browser's own autofill list and password managers are off so
 * they never cover ours.
 */
export function SuggestInput({
  value,
  onChange,
  suggestions,
  countLabel = '{n} suggestions. Use the up and down arrows.',
  className,
  onKeyDown,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(-1);
  const open = focused && !dismissed && suggestions.length > 0;
  const optionId = (i: number) => `${listId}-o${i}`;

  // Keep the whole list on screen. With the phone keyboard up (or a short window) there may be no room under the
  // box, so the list opens above it instead.
  const inputRef = useRef<HTMLInputElement>(null);
  const [above, setAbove] = useState(false);
  const [maxHeight, setMaxHeight] = useState(252);
  const count = open ? suggestions.length : 0;
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input || count === 0) return;
    const box = input.getBoundingClientRect();
    const edge =
      input.closest('dialog')?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY;
    const visibleBottom = Math.min(edge, window.visualViewport?.height ?? window.innerHeight);
    const need = Math.min(count * 44 + 12, 252);
    const room = visibleBottom - box.bottom - 8;
    const headerRoom = 150; // the modal's sticky title and progress bar
    // Stay below when at least three rows (or the whole list) fit there; otherwise open above if that is roomier.
    const fitsBelow = room >= Math.min(need, 144);
    const flip = !fitsBelow && box.top - headerRoom > room;
    setAbove(flip);
    setMaxHeight(Math.max(132, Math.min(252, flip ? box.top - headerRoom - 8 : room)));
  }, [count]);

  const move = (i: number) => {
    setActive(i);
    listRef.current?.children[i]?.scrollIntoView({ block: 'nearest' });
  };
  const pick = (i: number) => {
    onChange(suggestions[i]);
    setDismissed(true);
    setActive(-1);
  };

  return (
    <div className="relative">
      <input
        {...rest}
        ref={inputRef}
        {...passwordManagerOffAttrs}
        type="text"
        role="combobox"
        autoComplete="off"
        autoCorrect="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        value={value}
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          setDismissed(false);
          setActive(-1);
        }}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          setActive(-1);
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          const n = suggestions.length;
          if (e.key === 'ArrowDown' && n > 0) {
            e.preventDefault();
            if (!open) setDismissed(false);
            move(open ? (active + 1) % n : 0);
          } else if (e.key === 'ArrowUp' && open) {
            e.preventDefault();
            move(active <= 0 ? n - 1 : active - 1);
          } else if (e.key === 'Enter' && open && active >= 0) {
            e.preventDefault(); // pick the suggestion instead of submitting
            pick(active);
          } else if (e.key === 'Escape' && open) {
            e.preventDefault(); // close the list, not the booking window
            e.stopPropagation();
            setDismissed(true);
            setActive(-1);
          }
        }}
      />
      <ul
        id={listId}
        ref={listRef}
        role="listbox"
        hidden={!open}
        className={`absolute inset-x-0 z-20 overflow-y-auto overscroll-contain rounded-lg border-2 border-black/15 bg-white py-1 shadow-lg ${
          above ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}
        style={{ maxHeight }}
        data-placement={above ? 'above' : 'below'}
      >
        {open &&
          suggestions.map((s, i) => (
            <li
              key={s}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()} // keep focus in the box
              onClick={() => pick(i)}
              className="flex min-h-11 cursor-pointer items-center px-4 text-base hover:bg-soft aria-selected:bg-soft aria-selected:font-bold aria-selected:shadow-[inset_4px_0_0_var(--color-accent)]"
            >
              {s}
            </li>
          ))}
      </ul>
      <span role="status" className="sr-only">
        {open ? countLabel.replace('{n}', String(suggestions.length)) : ''}
      </span>
    </div>
  );
}
