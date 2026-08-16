import './styles.css'
import { MAX_PACKAGE_BYTES } from './protocol/limits.js'
import { parseAndValidatePackage } from './protocol/validate.js'
import { createEventStore } from './store/event-store.js'
import { projectAt } from './projection/projector.js'
import { createPlaybackController } from './playback/controller.js'
import { renderView } from './renderer/dom.js'

const viewer = document.getElementById('viewer')
const status = document.getElementById('status')
const fileInput = document.getElementById('package-file')
const cursorLabel = document.getElementById('cursor-label')
const buttons = { prev:document.getElementById('prev'), play:document.getElementById('play'), next:document.getElementById('next'), live:document.getElementById('live') }
let store = null
let controller = null
let previous = null

function setStatus(message, error=false) { status.textContent = message; status.classList.toggle('error', error) }
function draw(cursor) {
  if (!store) return
  const current = projectAt(store, cursor)
  renderView(viewer, current, previous)
  previous = current
  cursorLabel.textContent = `Event ${current.cursor} / ${store.length}${current.cursor === store.length ? ' · Live' : ' · Replay'}`
  buttons.play.textContent = controller?.playing ? '⏸ Pause' : '▶ Play'
}
function loadPackage(pkg, label) {
  controller?.destroy()
  store = createEventStore(pkg)
  previous = null
  controller = createPlaybackController({ maxCursor:store.length, onCursor:draw, intervalMs:850 })
  draw(store.length)
  setStatus(`${label} loaded · ${store.length} validated events`)
}
async function loadBuiltInDemo() {
  try {
    const response = await fetch('/examples/demo-events.json', { credentials:'same-origin' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const text = await response.text()
    loadPackage(parseAndValidatePackage(text), 'Built-in demo')
  } catch (error) { setStatus(`Demo load failed: ${error.message}`, true) }
}
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0]
  if (!file) return
  try {
    if (file.size > MAX_PACKAGE_BYTES) throw new Error(`File exceeds ${MAX_PACKAGE_BYTES} bytes`)
    loadPackage(parseAndValidatePackage(await file.text()), file.name)
  } catch (error) { setStatus(`Import rejected: ${error.message}`, true) }
  finally { fileInput.value = '' }
})
buttons.prev.addEventListener('click', () => controller?.step(-1))
buttons.next.addEventListener('click', () => controller?.step(1))
buttons.live.addEventListener('click', () => controller?.live())
buttons.play.addEventListener('click', () => { if (!controller) return; controller.playing ? controller.pause() : controller.play(); buttons.play.textContent = controller.playing ? '⏸ Pause' : '▶ Play' })
loadBuiltInDemo()
