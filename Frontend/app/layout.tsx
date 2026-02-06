import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Real time chat app",
  description: "Creating my first app that uses websocket",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="text-sm">
        {children}
      </body>
    </html>
  );
}
