import type { Metadata, Viewport } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import { SWRegister } from "@/components/SWRegister";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

const rounded = M_PLUS_Rounded_1c({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TaskFlowy",
  description: "タスクをマインドマップで管理するツリー型TODOアプリ",
  appleWebApp: {
    capable: true,
    title: "TaskFlowy",
    statusBarStyle: "default",
  },
  // metadata.icons を指定するとファイル規約(src/app/icon.png)のリンクは出力されないため、
  // favicon含めここで全て明示する
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={`${rounded.className} bg-white text-n900 antialiased`}>
        {children}
        <Toaster />
        <SWRegister />
      </body>
    </html>
  );
}
