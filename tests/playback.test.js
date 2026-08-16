import { describe, expect, it, vi } from 'vitest'
import { createPlaybackController } from '../src/playback/controller.js'
describe('replay controller',()=>{
 it('restarts from zero when Play is pressed at Live',()=>{ vi.useFakeTimers(); const seen=[]; const c=createPlaybackController({maxCursor:2,onCursor:x=>seen.push(x),intervalMs:150}); c.play(); expect(seen[0]).toBe(0); vi.advanceTimersByTime(310); expect(c.cursor).toBe(2); expect(c.playing).toBe(false); vi.useRealTimers() })
 it('clamps manual replay and returns to live',()=>{ const c=createPlaybackController({maxCursor:4,onCursor:()=>{}}); c.seek(1); c.step(-9); expect(c.cursor).toBe(0); c.live(); expect(c.cursor).toBe(4); c.destroy() })
})
