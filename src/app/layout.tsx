import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoiceSpeed",
  description: "语音加速应用",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
