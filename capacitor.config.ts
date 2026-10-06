import type { CapacitorConfig } from "@capacitor/cli";

// The Android shell loads the deployed site rather than a bundled copy of it.
//
// It was configured as `webDir: 'out'`, which is what you use when Next has
// written a static export into out/. This app has no `output: "export"` - it
// could not have one, since every screen it shows comes from a route handler
// talking to Supabase - so nothing ever wrote out/, and the index.html sitting
// there is zero bytes. The app installed and opened to a blank screen.
//
// WHY THE ADDRESS HERE HAS TO BE THE LIVE ONE, NOT MERELY ONE THAT WORKS
//
// This value is copied into the APK by `npx cap sync` and read on launch. What
// matters is that Capacitor keeps navigation inside the WebView only for this
// host and the ones named in allowNavigation; any other host is handed to the
// phone as an ACTION_VIEW intent, which opens Chrome.
//
// So when the site moved to logisco.company and this still said
// logisco-system.vercel.app, the very first request the app made came back as a
// 307 pointing at a host it did not recognise - and opening the app opened the
// browser. In a browser the old address still works, because browsers follow
// redirects, which is why it looked like a hosting fault. It was not. The app
// had simply never been told where the site went.
//
// allowNavigation lists the addresses that are also ours: the old vercel.app
// alias, and preview deployments. A redirect between two of our own addresses
// should stay inside the app instead of ejecting out of it.
//
// Set CAPACITOR_SERVER_URL to point a build somewhere else - a preview
// deployment, or a machine on the LAN when testing against a local dev server
// (use the machine IP, not localhost: on a phone or emulator localhost is the
// device itself).
const DEPLOYED_URL = "https://logisco.company";
const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim() || DEPLOYED_URL;

const config: CapacitorConfig = {
  appId: "com.logisco.app",
  appName: "Logisco",
  webDir: "capacitor-shell",
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          allowNavigation: ["logisco.company", "*.logisco.company", "*.vercel.app"],
          // The deployed site is https; this only allows plain http when a
          // local address is used for development.
          cleartext: /^http:\/\/(localhost|10\.0\.2\.2|192\.168\.)/.test(serverUrl),
        },
      }
    : {}),
  plugins: {
    // Without this, Android shows nothing for a push that arrives while the app
    // is open - it goes to the JavaScript listener and no further. The stall
    // watch handles "are you alright?" there, but every other notification was
    // silent for anybody using the app at the time, and a stopped truck with the
    // app open is the very case the stall alert exists for.
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
