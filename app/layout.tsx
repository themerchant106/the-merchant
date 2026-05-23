import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Merchant',
  description: 'Quality is an Intelligent Effort.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <nav className="site-nav" aria-label="Primary">
          <Link href="/" className="site-nav__wordmark">
            The Merchant
          </Link>
          <div className="site-nav__links">
            <Link href="/" className="site-nav__link">Home</Link>
            <Link href="/shop" className="site-nav__link">Shop</Link>
            <Link href="/authenticate" className="site-nav__link">Authenticate</Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
