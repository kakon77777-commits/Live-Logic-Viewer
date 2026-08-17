import { describe, expect, it, vi } from 'vitest'
import { BoundedUtf8Error, assertDeclaredContentLength, readBoundedUtf8Message, readBoundedUtf8Stream } from '../shared/bounded-utf8.js'

function stream(chunks){return new ReadableStream({start(controller){for(const chunk of chunks)controller.enqueue(chunk);controller.close()}})}
const bytes=text=>new TextEncoder().encode(text)

describe('bounded UTF-8 HTTP reader',()=>{
  it('joins valid streamed UTF-8 within the byte budget',async()=>{
    expect(await readBoundedUtf8Stream(stream([bytes('hello '),bytes('世界')]),32,'response body')).toBe('hello 世界')
  })

  it('rejects during streaming once the byte budget is crossed',async()=>{
    await expect(readBoundedUtf8Stream(stream([bytes('1234'),bytes('5678')]),6,'response body')).rejects.toMatchObject({code:'body_too_large'})
  })

  it('rejects invalid UTF-8 instead of replacement-decoding hostile bytes',async()=>{
    await expect(readBoundedUtf8Stream(stream([new Uint8Array([0xc3,0x28])]),10,'body')).rejects.toMatchObject({code:'invalid_utf8_body'})
  })

  it('rejects an oversized declared Content-Length before reading the stream',async()=>{
    const message=new Response(stream([bytes('small')]),{headers:{'content-length':'999'}})
    const spy=vi.spyOn(message.body,'getReader')
    await expect(readBoundedUtf8Message(message,100,'response body')).rejects.toMatchObject({code:'body_too_large'})
    expect(spy).not.toHaveBeenCalled()
  })

  it('rejects malformed Content-Length values',()=>{
    expect(()=>assertDeclaredContentLength(new Headers({'content-length':'-1'}),100,'body')).toThrow(BoundedUtf8Error)
  })
})
