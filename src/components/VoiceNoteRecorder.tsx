import React, { useState, useRef, useEffect } from 'react'
import { Mic, Square, Play, Pause, Trash2, Save, RotateCcw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface VoiceNoteRecorderProps {
  visitId: string
  onSaveVoiceNote: (visitId: string, audioData: Blob) => void
  hasVoiceNote: boolean
  voiceNoteUrl?: string // base64 data URL for saved notes
}

// Cap a single note so it stays playable and storage-friendly.
const MAX_SECONDS = 120

/** Pick the best-quality recording container/codec the browser supports. */
function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ]
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
    for (const t of candidates) {
      if (MediaRecorder.isTypeSupported(t)) return t
    }
  }
  return ''
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function VoiceNoteRecorder({
  visitId,
  onSaveVoiceNote,
  hasVoiceNote,
  voiceNoteUrl,
}: VoiceNoteRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)        // seconds while recording
  const [clipDuration, setClipDuration] = useState(0) // length of the recorded clip

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef(0) // latest elapsed, for stopRecording without stale closure

  useEffect(() => { elapsedRef.current = elapsed }, [elapsed])

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  // Cleanup on unmount: stop timer, tracks, and revoke object URL.
  useEffect(() => {
    return () => {
      stopTimer()
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    }
  }, [recordedUrl])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      })
      streamRef.current = stream

      const mimeType = pickMimeType()
      const mediaRecorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 128000,
      })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const type = mediaRecorder.mimeType || mimeType || 'audio/webm'
        const audioBlob = new Blob(chunksRef.current, { type })
        const url = URL.createObjectURL(audioBlob)
        setRecordedBlob(audioBlob)
        setRecordedUrl(url)
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }

      mediaRecorder.start()
      setIsRecording(true)
      setElapsed(0)
      stopTimer()
      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1
          if (next >= MAX_SECONDS) stopRecording()
          return next
        })
      }, 1000)
    } catch {
      alert('Microphone permission denied. Enable it in your browser settings.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    stopTimer()
    setClipDuration(prev => (elapsedRef.current > 0 ? elapsedRef.current : prev))
    setIsRecording(false)
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }
  }

  const saveRecording = () => {
    if (recordedBlob) {
      onSaveVoiceNote(visitId, recordedBlob)
      setRecordedBlob(null)
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl)
        setRecordedUrl(null)
      }
      setIsPlaying(false)
    }
  }

  const discardRecording = () => {
    setRecordedBlob(null)
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl)
      setRecordedUrl(null)
    }
    setIsPlaying(false)
    setClipDuration(0)
  }

  const reRecord = () => {
    discardRecording()
    startRecording()
  }

  const deleteExistingNote = () => {
    onSaveVoiceNote(visitId, new Blob()) // empty blob = delete
  }

  // Audio source: freshly recorded takes priority over saved
  const activeSrc = recordedUrl || voiceNoteUrl

  return (
    <div className="space-y-2">
      <AnimatePresence mode="wait">
        {/* No note yet — show record button */}
        {!hasVoiceNote && !recordedBlob && !isRecording && (
          <motion.button
            key="record-btn"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={startRecording}
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs rounded-lg hover:shadow-md hover:shadow-red-500/40 transition-all"
          >
            <Mic className="h-3.5 w-3.5" />
            Record voice note
          </motion.button>
        )}

        {/* Recording in progress — live timer + pulsing indicator */}
        {isRecording && (
          <motion.div
            key="recording"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800"
          >
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="h-2.5 w-2.5 rounded-full bg-red-500 flex-shrink-0"
            />
            <span className="text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">
              {formatTime(elapsed)}
            </span>
            <span className="text-[10px] text-red-400 dark:text-red-500 flex-1">
              / {formatTime(MAX_SECONDS)} max
            </span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={stopRecording}
              className="flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors"
            >
              <Square className="h-3 w-3" />
              Stop
            </motion.button>
          </motion.div>
        )}

        {/* Freshly recorded — preview & save */}
        {recordedBlob && (
          <motion.div
            key="recorded-controls"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-800"
          >
            {activeSrc && (
              <audio ref={audioRef} src={activeSrc} onEnded={() => setIsPlaying(false)} />
            )}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={togglePlay}
              className="p-1.5 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
              title={isPlaying ? 'Pause' : 'Preview'}
            >
              {isPlaying
                ? <Pause className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                : <Play className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />}
            </motion.button>
            <span className="text-xs text-purple-600 dark:text-purple-400 flex-1">
              🎙️ Ready{clipDuration > 0 ? ` · ${formatTime(clipDuration)}` : ''}
            </span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={reRecord}
              className="p-1.5 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
              title="Re-record"
            >
              <RotateCcw className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={saveRecording}
              className="px-2.5 py-1 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
            >
              <Save className="h-3 w-3" />
              Save
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={discardRecording}
              className="px-2.5 py-1 text-xs bg-slate-400 text-white rounded-lg hover:bg-slate-500 transition-colors"
            >
              Discard
            </motion.button>
          </motion.div>
        )}

        {/* Saved voice note — play & delete */}
        {hasVoiceNote && !recordedBlob && !isRecording && (
          <motion.div
            key="saved-controls"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-800"
          >
            {voiceNoteUrl && (
              <audio ref={audioRef} src={voiceNoteUrl} onEnded={() => setIsPlaying(false)} />
            )}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={togglePlay}
              className="p-1.5 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying
                ? <Pause className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                : <Play className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />}
            </motion.button>
            <span className="text-xs text-purple-600 dark:text-purple-400 flex-1">🎙️ Voice note</span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={deleteExistingNote}
              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Delete voice note"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
