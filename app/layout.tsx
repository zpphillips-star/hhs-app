import type { Metadata } from "next";
import { Modern_Antiqua, Crimson_Text } from "next/font/google";
import "./globals.css";
import SetupBanner from "@/components/SetupBanner";
import RouteAuthGuard from "@/components/RouteAuthGuard";

const modernAntiqua = Modern_Antiqua({
  variable: "--font-modern-antiqua",
  subsets: ["latin"],
  weight: "400",
});

const crimsonText = Crimson_Text({
  variable: "--font-crimson-text",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
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
    <html lang="en" className={`${modernAntiqua.variable} ${crimsonText.variable} h-full`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0d0b0f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HHS" />
        <link rel="icon" type="image/png" sizes="192x192" href="/pwa-icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/pwa-icon-512.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var params = new URLSearchParams(window.location.search);
              if (params.get('browser') === '1' || params.get('hhs_browser') === '1') {
                localStorage.removeItem('__hhs_native_app__');
                document.documentElement.removeAttribute('data-hhs-app-mode');
                window.__HHS_NATIVE_APP__ = false;
                return;
              }
              if (params.get('hhs_app') === '1' || localStorage.getItem('__hhs_native_app__') === '1') {
                document.documentElement.setAttribute('data-hhs-app-mode', 'true');
                window.__HHS_NATIVE_APP__ = true;
                localStorage.setItem('__hhs_native_app__', '1');
              }
            } catch (_) {}
          })();
        `}} />
      </head>
      <body className="min-h-full flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <RouteAuthGuard>{children}</RouteAuthGuard>
        <SetupBanner />
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
