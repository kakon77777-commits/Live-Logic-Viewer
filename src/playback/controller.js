export function createPlaybackController({ maxCursor, onCursor, intervalMs = 900 }) {
  const max = Math.max(0, Math.trunc(Number(maxCursor) || 0))
  let cursor = max
  let timer = null
  let playing = false

  const emit = () => onCursor(cursor)
  const stopTimer = () => { if (timer !== null) clearTimeout(timer); timer = null; playing = false }
  const schedule = () => {
    timer = setTimeout(() => {
      if (!playing) return
      cursor = Math.min(max, cursor + 1)
      if (cursor >= max) { stopTimer(); emit(); return }
      emit(); schedule()
    }, Math.max(150, Number(intervalMs) || 900))
  }
  return {
    get cursor() { return cursor },
    get playing() { return playing },
    play() {
      stopTimer()
      if (max === 0) { emit(); return false }
      if (cursor >= max) cursor = 0
      playing = true
      emit()
      schedule()
      return true
    },
    pause() { stopTimer(); emit() },
    step(delta) { stopTimer(); cursor = Math.max(0, Math.min(max, cursor + Math.trunc(Number(delta) || 0))); emit() },
    seek(next) { stopTimer(); cursor = Math.max(0, Math.min(max, Math.trunc(Number(next) || 0))); emit() },
    live() { stopTimer(); cursor = max; emit() },
    destroy() { stopTimer() },
  }
}
