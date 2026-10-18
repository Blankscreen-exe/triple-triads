import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { SiteHeader } from '@/components/site-header';
import './globals.css';

// Self-hosted (SIL Open Font License, see ./fonts) so builds never depend on reaching Google Fonts.
const cinzel = localFont({
  src: './fonts/cinzel-latin-variable.woff2',
  weight: '400 900',
  variable: '--font-cinzel',
  display: 'swap',
});
const exo2 = localFont({
  src: './fonts/exo-2-latin-variable.woff2',
  weight: '100 900',
  variable: '--font-exo2',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Triple Triad', template: '%s · Triple Triad' },
  description: 'Play Triple Triad online with your own cards and decks.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${cinzel.variable} ${exo2.variable}`}>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
