import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "mottainAI｜在庫から今日のごはんへ",
  description: "食材の在庫・期限・買い物・レシピをひとつにつなぐ、食品ロス削減アプリ。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
