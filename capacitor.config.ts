import type { CapacitorConfig } from "@capacitor/cli";

// The Android shell loads the deployed site rather than a bundled copy of it.
//
// It was configured as `webDir: 'out'`, which is what you use when Next has
// written a static export into out/. This app has no `output: "export"` - it
// could not have one, since every screen it shows comes from a route handler
// talking to Supabase - so nothing ever wrote out/, and the index.html sitting
// there is zero bytes. The app installed and opened to a blank screen.
//
// The deployed site is the default, so `npx cap sync` does the right thing
// on a fresh clone with nothing configured. Set CAPACITOR_SERVER_URL to point
// a build somewhere else - a preview deployment, or a machine on the LAN when
// testing against a local dev server (use the machine IP, not localhost: on a
// phone or emulator localhost is the device itself).
const DEPLOYED_URL = "https://logisco-system.vercel.app";
const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim() || DEPLOYED_URL;

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
