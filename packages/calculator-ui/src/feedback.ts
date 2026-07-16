/**
 * Optional press feedback: a short vibration and/or a key-click.
 *
 * Both are opt-in-safe. Vibration is a no-op where the API is absent (most
 * desktops, iOS). The click uses a tiny WebAudio blip generated on the fly, so
 * there is no audio asset to ship and nothing plays until the user has interacted
 * (browsers block audio before a gesture, which suits a key press exactly).
 */
export class Feedback {
  private ctx: AudioContext | null = null;
  sound = false;
  haptics = true;

  press(): void {
    if (this.haptics) this.vibrate();
    if (this.sound) this.click();
  }

  private vibrate(): void {
    try {
      navigator.vibrate?.(8);
    } catch {
      /* unsupported */
    }
  }

  private click(): void {
    try {
      this.ctx ??= new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 620;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    } catch {
      /* audio unavailable */
    }
  }
}
