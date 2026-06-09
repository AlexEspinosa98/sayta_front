import { useState, useEffect, useRef } from 'react'

export function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const totalLen = chunks.reduce((s, c) => s + c.length, 0)
  const samples  = new Float32Array(totalLen)
  let off = 0; for (const c of chunks) { samples.set(c, off); off += c.length }
  const buf  = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buf)
  const str  = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true)
  str(8, 'WAVE'); str(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  str(36, 'data'); view.setUint32(40, samples.length * 2, true)
  let o = 44
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2
  }
  return new Blob([buf], { type: 'audio/wav' })
}

export function useAudioRecorder() {
  const [audioFile, setAudioFile]     = useState<File | null>(null)
  const [audioUrl, setAudioUrl]       = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const urlRef       = useRef<string | null>(null)
  const ctxRef       = useRef<AudioContext | null>(null)
  const sourceRef    = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef    = useRef<MediaStream | null>(null)
  const chunksRef    = useRef<Float32Array[]>([])

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    processorRef.current?.disconnect(); sourceRef.current?.disconnect()
    ctxRef.current?.close(); streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  const clearAudio = () => {
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
    setAudioFile(null); setAudioUrl(null)
  }

  const setFromBlob = (blob: Blob, name: string) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(blob)
    urlRef.current = url; setAudioUrl(url)
    setAudioFile(new File([blob], name, { type: blob.type }))
  }

  const setFromFile = (f: File) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(f)
    urlRef.current = url; setAudioUrl(url); setAudioFile(f)
  }

  const stopRecording = () => {
    processorRef.current?.disconnect(); sourceRef.current?.disconnect()
    streamRef.current?.getTracks().forEach(t => t.stop())
    const sampleRate = ctxRef.current?.sampleRate ?? 44100
    ctxRef.current?.close()
    const blob = encodeWav(chunksRef.current, sampleRate)
    setFromBlob(blob, `grabacion_${Date.now()}.wav`)
    setIsRecording(false)
  }

  const toggleRecording = async () => {
    if (isRecording) { stopRecording(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx    = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const proc   = ctx.createScriptProcessor(4096, 1, 1)
      chunksRef.current = []
      proc.onaudioprocess = e => {
        chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)))
      }
      source.connect(proc); proc.connect(ctx.destination)
      ctxRef.current = ctx; sourceRef.current = source
      processorRef.current = proc; streamRef.current = stream
      setIsRecording(true)
    } catch { /* micrófono denegado */ }
  }

  return { audioFile, audioUrl, isRecording, clearAudio, setFromFile, setFromBlob, toggleRecording }
}
