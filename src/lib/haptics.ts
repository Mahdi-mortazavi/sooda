/** Tiny haptic tap on supported devices; silently no-ops elsewhere. */
export function vibrate(durationMs = 10): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(durationMs)
    }
  } catch {
    // ignore — haptics are best-effort
  }
}
