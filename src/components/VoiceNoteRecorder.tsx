import React, { useState, useRef, useEffect } from 'react'
import { Mic, Square, Play, Pause, Trash2, Save } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface VoiceNoteRecorderProps {
  visitId: string
  onSaveVoiceNote: (visitId: string, audioData: Blob) => void
  hasVoiceNote: boolean
  voiceNoteUrl?: string // base64 data URL for saved notes
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Revoke object URLs on cleanup
  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    }
  }, [recordedUrl])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        chunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(audioBlob)
        setRecordedBlob(audioBlob)
        setRecordedUrl(url)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      alert('Microphone permission denied. Enable it in your browser.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
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
  }

  const deleteExistingNote = () => {
    onSaveVoiceNote(visitId, new Blob()) // empty blob = delete
  }

  // Audio source: freshly recorded takes priority over saved
  const activeSrc = recordedUrl || voiceNoteUrl

  const recordingVariants = {
    initial: { scale: 1 },
    recording: {
      scale: [1, 1.15, 1],
      transition: { duration: 0.8, repeat: Infinity },
    },
  }

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

        {/* Recording in progress */}
        {isRecording && (
          <motion.button
            key="stop-btn"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            variants={recordingVariants}
            whileTap={{ scale: 0.95 }}
            onClick={stopRecording}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg animate-pulse"
          >
            <Square className="h-3.5 w-3.5" />
            Recording…
          </motion.button>
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
              <audio
                ref={audioRef}
                src={activeSrc}
                onEnded={() => setIsPlaying(false)}
              />
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
                : <Play className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              }
            </motion.button>
            <span className="text-xs text-purple-600 dark:text-purple-400 flex-1">🎙️ Ready</span>
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
        {hasVoiceNote && !recordedBlob && (
          <motion.div
            key="saved-controls"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-800"
          >
            {voiceNoteUrl && (
              <audio
                ref={audioRef}
                src={voiceNoteUrl}
                onEnded={() => setIsPlaying(false)}
              />
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
                : <Play className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              }
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
