export class BoundedUtf8Error extends Error {
  constructor(message,code='invalid_utf8_body'){super(message);this.name='BoundedUtf8Error';this.code=code}
}

function validateMaxBytes(maxBytes){if(!Number.isInteger(maxBytes)||maxBytes<0)throw new TypeError('maxBytes must be a non-negative integer')}
function fatalDecode(bytes,label){
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}
  catch{throw new BoundedUtf8Error(`${label} is not valid UTF-8`,'invalid_utf8_body')}
}

export function assertDeclaredContentLength(headers,maxBytes,label='body') {
  validateMaxBytes(maxBytes)
  const raw=headers?.get?.('content-length')
  if(raw==null||raw==='')return
  if(!/^\d+$/.test(raw))throw new BoundedUtf8Error(`${label} Content-Length is invalid`,'invalid_content_length')
  const declared=Number(raw)
  if(!Number.isSafeInteger(declared))throw new BoundedUtf8Error(`${label} Content-Length is invalid`,'invalid_content_length')
  if(declared>maxBytes)throw new BoundedUtf8Error(`${label} exceeds ${maxBytes} bytes`,'body_too_large')
}

export async function readBoundedUtf8Stream(stream,maxBytes,label='body') {
  validateMaxBytes(maxBytes)
  if(!stream||typeof stream.getReader!=='function')return''
  const reader=stream.getReader()
  const decoder=new TextDecoder('utf-8',{fatal:true})
  let total=0,text='',done=false
  try {
    while(true){
      const chunk=await reader.read()
      if(chunk.done){done=true;break}
      const value=chunk.value
      if(!(value instanceof Uint8Array))throw new BoundedUtf8Error(`${label} stream produced a non-byte chunk`)
      total+=value.byteLength
      if(total>maxBytes){
        try{await reader.cancel('body too large')}catch{}
        throw new BoundedUtf8Error(`${label} exceeds ${maxBytes} bytes`,'body_too_large')
      }
      try{text+=decoder.decode(value,{stream:true})}
      catch{throw new BoundedUtf8Error(`${label} is not valid UTF-8`,'invalid_utf8_body')}
    }
    try{text+=decoder.decode()}
    catch{throw new BoundedUtf8Error(`${label} is not valid UTF-8`,'invalid_utf8_body')}
    return text
  } finally {
    if(!done){try{reader.releaseLock()}catch{}}
  }
}

export async function readBoundedUtf8Message(message,maxBytes,label='body') {
  assertDeclaredContentLength(message?.headers,maxBytes,label)
  return readBoundedUtf8Stream(message?.body,maxBytes,label)
}

export async function readBoundedUtf8Blob(blob,maxBytes,label='file') {
  validateMaxBytes(maxBytes)
  if(!blob||typeof blob.arrayBuffer!=='function'||typeof blob.size!=='number')throw new TypeError(`${label} must be a Blob/File`)
  if(blob.size>maxBytes)throw new BoundedUtf8Error(`${label} exceeds ${maxBytes} bytes`,'body_too_large')
  const buffer=await blob.arrayBuffer()
  if(buffer.byteLength>maxBytes)throw new BoundedUtf8Error(`${label} exceeds ${maxBytes} bytes`,'body_too_large')
  return fatalDecode(new Uint8Array(buffer),label)
}
