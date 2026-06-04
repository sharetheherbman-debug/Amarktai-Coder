import './globals.css';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Amarktai Coder — Plan smarter. Code faster. Ship safer.',
  description:
    'Repo-aware AI coding workbench. Audit, plan, edit, review diffs, and ship via pull requests.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body data-testid="app-root">{children}</body>
    </html>
  );
}
