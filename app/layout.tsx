import type { Metadata } from "next";
import { Modern_Antiqua } from "next/font/google";
import "./globals.css";

const modernAntiqua = Modern_Antiqua({
  variable: "--font-modern-antiqua",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Hallowed Hop Society — XXXI",
  description: "31 unique beers in 31 haunted days. Through ritual we pour, through hops we unite.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${modernAntiqua.variable} h-full`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#191726" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HHS" />
        <link rel="apple-touch-icon" href="/icon.png" />
      </head>
      <body className="min-h-full flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js');
            });
          }
        `}} />
      </body>
    </html>
  );
}
