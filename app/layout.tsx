import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "A门",
  description: "再也不用付费做伴奏啦～"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hans">
      <body>{children}</body>
    </html>
  );
}
