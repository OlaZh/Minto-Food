import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'Minto Admin',
  description: 'Admin panel for Minto Food',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className="h-full" suppressHydrationWarning>
      <body className={`${inter.className} min-h-full bg-gray-50`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
