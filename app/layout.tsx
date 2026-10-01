import type { Metadata, Viewport } from "next";
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

// The Android shell targets SDK 36, where edge-to-edge is not a choice: the
// WebView is laid out behind the status bar and the navigation bar, and Android
// 16 removed the flag that used to opt out. Declaring viewport-fit=cover is
// what makes env(safe-area-inset-*) report the real numbers instead of zero -
// globals.css reads them as --safe-top and --safe-bottom, and the app shells,
// the header, the sidebars and the toasts pad themselves with them.
//
// Next supplies width=device-width, initial-scale=1 by default; both are
// repeated here because declaring one field of the viewport replaces the lot.
//
// Deliberately no maximumScale and no userScalable: locking out pinch zoom
// fails WCAG 1.4.4, and a warehouse in daylight is exactly where somebody
// needs to zoom.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
