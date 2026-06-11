import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Intelligent Traffic System Command Center",
  description: "Smart City real-time traffic monitoring, congestion log analytics, and intersection status control dashboard.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark bg-[#090d16] text-[#f9fafb]">
      <body className={`${inter.className} min-h-screen overflow-x-hidden antialiased`}>
        {children}
      </body>
    </html>
  );
}
