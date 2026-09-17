import type { CapacitorConfig } from "@capacitor/cli";

// The Android shell loads the deployed site rather than a bundled copy of it.
//
// It was configured as `webDir: 'out'`, which is what you use when Next has
// written a static export into out/. This app has no `output: "export"` - it
// could not have one, since every screen it shows comes from a route handler
// talking to Supabase - so nothing ever wrote out/, and the index.html sitting
// there is zero bytes. The app installed and opened to a blank screen.
//
// Set CAPACITOR_SERVER_URL to the deployed site (for example
// https://logisco.vercel.app) before running `npx cap sync`. Without it the
// shell falls back to capacitor-shell/, a single page that says so instead
// of showing nothing.
const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.logisco.app",
  appName: "Logisco",
  webDir: "capacitor-shell",
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          // The deployed site is https; this only allows plain http when a
          // local address is used for development.
          cleartext: /^http:\/\/(localhost|10\.0\.2\.2|192\.168\.)/.test(serverUrl),
        },
      }
    : {}),
};

export default config;
