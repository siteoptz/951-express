'use client';

import { Button } from '@/components/ui/Button';
import { useBooking } from './BookingProvider';

export function QuoteButton({
  children,
  variant = 'primary',
  className = '',
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'ghost' | 'ghostDark';
  className?: string;
}) {
  const { openBooking } = useBooking();
  return (
    <Button variant={variant} className={className} onClick={openBooking}>
      {children}
    </Button>
  );
}
