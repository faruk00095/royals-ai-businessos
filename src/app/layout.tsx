import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "ROYAL’S AI BusinessOS", description: "One clear view of your business." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
