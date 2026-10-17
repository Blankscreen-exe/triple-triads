import type { Metadata } from 'next';
import { Cinzel, Exo_2 } from 'next/font/google';
import { SiteHeader } from '@/components/site-header';
import './globals.css';

const cinzel = Cinzel({ subsets: ['latin'], variable: '--font-cinzel', display: 'swap' });
const exo2 = Exo_2({ subsets: ['latin'], variable: '--font-exo2', display: 'swap' });

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
