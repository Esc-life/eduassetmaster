import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

import { Geist, Geist_Mono } from "next/font/google";

import { OpenCVLoader } from '@/components/OpenCVLoader';
import { Providers } from '@/components/Providers';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EduAsset Master",
  description: "Advanced School Asset Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <OpenCVLoader />
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
          <Sidebar />
          <Providers> {/* Wrapped content with Providers */}
            <div className="flex-1 flex flex-col ml-64">
              <Header />
              <main className="p-6">
                {children}
              </main>
            </div>
          </Providers>
        </div>
      </body>
    </html>
  );
}
