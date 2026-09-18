import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Logisco",
    template: "%s | Logisco",
  },
  description: "Logistics management for bookings, dispatch, fleet and delivery tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* bg-midnight-950 and text-midnight-50 used to be here. Those colours
        live in tailwind.config.ts, which Tailwind 4 does not read - it takes
        its theme from CSS - so both classes produced nothing and the body
        fell through to globals.css. The palette is still in that config file
        if it is ever wanted; wiring it up needs an @theme block in
        globals.css, not a JS config. */}
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
