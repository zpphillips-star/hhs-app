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
      <body className="min-h-full flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        {children}
      </body>
    </html>
  );
}
