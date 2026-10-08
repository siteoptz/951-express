'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { company } from '@/config/company';

export type BookingOptions = { pickupZip?: string };
type BookingContextValue = { openBooking: (options?: BookingOptions) => void; prefill: BookingOptions };

const BookingContext = createContext<BookingContextValue | null>(null);

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBooking must be used inside BookingProvider');
  return ctx;
}

// Phase 1: an empty modal shell. The real booking flow arrives in Phase 5.
export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [prefill, setPrefill] = useState<BookingOptions>({});

  const openBooking = useCallback((options?: BookingOptions) => {
    setPrefill(options ?? {});
    setOpen(true);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <BookingContext.Provider value={{ openBooking, prefill }}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby="booking-title"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
        className="m-auto h-full max-h-none w-full max-w-none overflow-y-auto bg-white p-0 sm:h-auto sm:max-h-[90vh] sm:w-[520px] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <h2 id="booking-title" className="font-display text-2xl font-extrabold uppercase">
            Get My Instant Quote
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="rounded p-2 text-2xl leading-none text-muted hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-10 text-center text-muted">
          {prefill.pickupZip && <p className="mb-2 font-semibold text-ink">Pickup ZIP: {prefill.pickupZip}</p>}
          <p>Online booking is coming soon.</p>
          <p className="mt-2">
            Call us at{' '}
            <a className="font-semibold text-ink underline" href={company.phoneHref}>
              {company.phone}
            </a>{' '}
            to book now.
          </p>
        </div>
      </dialog>
    </BookingContext.Provider>
  );
}
