"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { apiFetch } from "@/app/lib/apiClient";
import { askCrew } from "@/app/lib/stallAsk";
import { PUSH_CHANNELS } from "@/app/lib/pushChannels";
import { checkInTripFromLink } from "@/app/lib/stallRules";

// Push, for the phone app.
//
// The site is the same in a browser and inside the Android shell, so this does
// nothing on the web: only the installed app has a device to register. The
// token is kept so it can be handed back when the person signs out - a shared
// phone must not keep sending one driver's work to the next.

const TOKEN_KEY = "logisco_push_token";

export function storedPushToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Gives up this phone's token, so it stops receiving that person's notifications. */
export async function releasePushToken(): Promise<void> {
  const token = storedPushToken();
  if (!token) return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Blocked storage: the server still forgets the token below.
  }
  try {
    await apiFetch(`/api/notifications/devices?token=${encodeURIComponent(token)}`, { method: "DELETE" });
  } catch (error) {
    console.error("Could not release this device:", error);
  }
}

export default function PushRegistration() {
  const router = useRouter();

  useEffect(() => {
    if (Capacitor.getPlatform() === "web") return;

    let active = true;
    const listeners: { remove: () => Promise<void> }[] = [];

    const start = async () => {
      try {
        // Asks the first time; afterwards this is what the person already chose.
        let permission = await PushNotifications.checkPermissions();
        if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
          permission = await PushNotifications.requestPermissions();
        }
        if (permission.receive !== "granted") {
          // Worth saying out loud: everything else below still works, the
          // phone registers, the server sends - and Android throws the
          // notification away on arrival.
          console.warn(`Notifications are turned off for this app (${permission.receive}); nothing will be shown.`);
          return;
        }

        // Android 8 and later drop a notification with no channel to land in.
        // Created on every launch, which is harmless: Android keeps the first
        // version of a channel and ignores later attempts to change it.
        if (Capacitor.getPlatform() === "android") {
          await PushNotifications.createChannel({
            id: PUSH_CHANNELS.general,
            name: "Logisco",
            description: "Deliveries, foul trips and fleet updates",
            importance: 5,
            visibility: 1,
          }).catch((error) => console.error("Could not create the notification channel:", error));

          // The ones that must be felt as well as seen. "logisco" above was
          // made without vibration - the plugin defaults it off - and Android
          // will not let an existing channel be changed, so this is a new one.
          await PushNotifications.createChannel({
            id: PUSH_CHANNELS.alerts,
            name: "Truck alerts",
            description: "Asked when the truck has stopped - vibrates and sounds",
            importance: 5,
            visibility: 1,
            vibration: true,
            lights: true,
          }).catch((error) => console.error("Could not create the alerts channel:", error));
        }

        listeners.push(
          await PushNotifications.addListener("registration", async (token) => {
            if (!active) return;
            try {
              window.localStorage.setItem(TOKEN_KEY, token.value);
            } catch {
              // Storage is blocked; the token still reaches the server below.
            }
            try {
              await apiFetch("/api/notifications/devices", {
                method: "POST",
                body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform() }),
              });
            } catch (error) {
              console.error("Could not register this device for push:", error);
            }
          }),
        );

        listeners.push(
          await PushNotifications.addListener("registrationError", (error) => {
            console.error("Push registration was refused:", error);
          }),
        );

        // A push that lands while the app is open is not shown by Android - it
        // is handed here and nowhere else. For most notifications the bell is
        // enough. For "are you alright?" it is not: the crew are standing still
        // with the app in front of them, which is exactly when they must be
        // asked, so it opens the question on whatever screen they are on.
        listeners.push(
          await PushNotifications.addListener("pushNotificationReceived", (notification) => {
            const trip = checkInTripFromLink(notification.data?.link);
            if (!trip) return;
            askCrew({
              trip,
              from: "office",
              title: notification.title,
              body: notification.body,
            });
          }),
        );

        // Tapping a notification opens what it is about.
        listeners.push(
          await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
            const link = action.notification.data?.link;
            if (typeof link === "string" && link.startsWith("/")) router.push(link);
          }),
        );

        await PushNotifications.register();
      } catch (error) {
        console.error("Push notifications are unavailable:", error);
      }
    };

    void start();

    return () => {
      active = false;
      for (const listener of listeners) void listener.remove();
    };
  }, [router]);

  return null;
}
