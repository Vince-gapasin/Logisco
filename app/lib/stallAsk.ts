// Asking the crew "are you alright?" from anywhere in the app.
//
// The question used to live only inside the trip's own screen, so it reached a
// crew only if they happened to be looking at it. A push that arrived while the
// app was open was thrown away by Android - the plugin shows nothing in the
// foreground unless told to - and the crew heard nothing at all while standing
// still with the app in their hand.
//
// So anything that learns the crew should be asked - a push landing, the
// phone's own clock passing a rung - says so here, and the stall watch in the
// crew portal opens the question wherever they are.

export const STALL_ASK_EVENT = "logisco:stall-ask";

export interface StallAsk {
  trip: string;
  /** What raised it: this phone's own clock, or the office's schedule. */
  from: "phone" | "office";
  title?: string;
  body?: string;
}

export function askCrew(ask: StallAsk): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<StallAsk>(STALL_ASK_EVENT, { detail: ask }));
}

/**
 * A short, unmistakable sound, and a buzz where the phone allows it.
 *
 * Best-effort on both counts. The Android shell lets audio play without a tap,
 * so the tone normally sounds; vibration needs a permission only newer builds
 * of the app ask for, and is silently ignored without it.
 */
export function soundTheAlarm(): void {
  if (typeof window === "undefined") return;

  try {
    navigator.vibrate?.([400, 200, 400, 200, 400]);
  } catch {
    // Not allowed here; the tone still plays.
  }

  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const start = context.currentTime;

    // Three rising pairs: loud enough to notice in a cab, short enough not to
    // be a siren.
    for (let i = 0; i < 3; i++) {
      for (const [offset, frequency] of [
        [0, 880],
        [0.18, 1175],
      ] as const) {
        const at = start + i * 0.6 + offset;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.4, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.17);
      }
    }

    setTimeout(() => void context.close().catch(() => {}), 2_500);
  } catch {
    // No audio on this device; the sheet is still on screen.
  }
}
