/**
 * The Android notification channels, which decide how a notification behaves
 * on arrival - and only the channel decides. Since Android 8 a message asking
 * to vibrate is ignored if its channel does not.
 *
 * "logisco" was created without vibration, because the plugin's default is off
 * and nobody passed it, so Logisco pushes do not vibrate. A channel
 * cannot be changed once a phone has it, so the alerts that must be felt - a
 * crew asked whether they are alright - go to a second one created with
 * vibration on. Both are created by components/PushNotifications.tsx; the
 * server picks one per message.
 *
 * A phone that has not opened the app since "alerts" was added does not have
 * it yet; Android then uses the manifest's default, "logisco", which shows the
 * notification without the buzz.
 */
export const PUSH_CHANNELS = { general: "logisco", alerts: "logisco_alerts" } as const;
export type PushChannel = keyof typeof PUSH_CHANNELS;
