'use client';

import dynamic from 'next/dynamic';
import { createContext, useCallback, useContext, useState } from 'react';

export type BookingOptions = { pickupZip?: string };
type BookingContextValue = {
  openBooking: (options?: BookingOptions) => void;
  prefill: BookingOptions;
};

const BookingContext = createContext<BookingContextValue | null>(null);

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBooking must be used inside BookingProvider');
  return ctx;
}

// The modal code loads only when someone first opens it.
const BookingModal = dynamic(() => import('./BookingModal'), { ssr: false });

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [prefill, setPrefill] = useState<BookingOptions>({});
  const [nonce, setNonce] = useState(0);

  const openBooking = useCallback((options?: BookingOptions) => {
    setPrefill(options ?? {});
    setNonce((n) => n + 1);
    setEverOpened(true);
    setOpen(true);
  }, []);

  return (
    <BookingContext.Provider value={{ openBooking, prefill }}>
      {children}
      {everOpened && (
        <BookingModal
          key={nonce}
          open={open}
          onClose={() => setOpen(false)}
          pickupZip={prefill.pickupZip}
        />
      )}
    </BookingContext.Provider>
  );
}
