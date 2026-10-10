import type { Metadata } from 'next';
import { Inter, Barlow_Condensed } from 'next/font/google';
import { BookingProvider } from '@/components/booking/BookingProvider';
import { siteUrl } from '@/config/site';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const display = Barlow_Condensed({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
});

const title = '951 Express | Licensed & Bonded Auto Transport';
const description =
  'Licensed and bonded auto transport from Corona, CA. Weekly runs between Southern California, Phoenix, Tucson, and El Paso and the Southeast and Mid-Atlantic. Get an instant quote online.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title,
  description,
  // The icons (src/app/icon.png, apple-icon.png, favicon.ico) and the Open Graph image (src/app/opengraph-image.tsx)
  // are picked up from those files.
  openGraph: { title, description, siteName: '951 Express Inc', type: 'website', locale: 'en_US' },
  twitter: { card: 'summary_large_image', title, description },
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
