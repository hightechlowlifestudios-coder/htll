import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const ogImage = `${protocol}://${host}/og.png`;

  return {
    title: "High Tech Low Life — Muhtesem Pantalon",
    description: "High Tech Low Life Studios Drop 001.",
    openGraph: {
      title: "High Tech Low Life — Muhtesem Pantalon",
      description: "Drop 001. Tek ürün. Gereksiz hiçbir şey yok.",
      images: [{ url: ogImage, width: 1254, height: 1254, alt: "High Tech Low Life Drop 001 symbol" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "High Tech Low Life — Muhtesem Pantalon",
      description: "Drop 001. Tek ürün. Gereksiz hiçbir şey yok.",
      images: [ogImage],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
