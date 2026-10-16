import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maktab kutubxonasi",
  description: "Maktab kutubxonasi: kitob berish, qaytarish va o'qish rag'batlari",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
