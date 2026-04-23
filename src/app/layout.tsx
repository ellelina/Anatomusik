import type { Metadata } from "next";
import { Inter, DM_Sans, DM_Mono, Orbitron } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["200", "400", "500"], variable: "--font-dm-sans" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["300"], variable: "--font-dm-mono" });
const orbitron = Orbitron({ subsets: ["latin"], weight: ["400", "900"], variable: "--font-orbitron" });

export const metadata: Metadata = {
  title: "Anatomusik | Discover Your Niche Music Taste",
  description:
    "Connect your Spotify account and discover the micro-genres that define your unique listening personality.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${dmSans.variable} ${dmMono.variable} ${orbitron.variable} bg-neutral-950 text-white min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
