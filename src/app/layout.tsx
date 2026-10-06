import type { Metadata } from 'next';
import { Inter, Barlow_Condensed } from 'next/font/google';
import { BookingProvider } from '@/components/booking/BookingProvider';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const display = Barlow_Condensed({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
});

export const metadata: Metadata = {
  title: '951 Express | Licensed & Insured Auto Transport',
  description:
    'Licensed and insured auto transport from Corona, CA. Get an instant quote and reserve your spot online.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-screen antialiased">
        <BookingProvider>{children}</BookingProvider>
      </body>
    </html>
  );
}
