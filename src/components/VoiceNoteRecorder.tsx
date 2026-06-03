import React, { useState, useRef } from 'react'
import { Mic, Square, Play, Trash2, Send } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface VoiceNoteRecorderProps {
  visitId: string
  onSaveVoiceNote: (visitId: string, audioData: Blob) => void
  hasVoiceNote: boolean
  voiceNoteUrl?: string
}

export function VoiceNoteRecorder({
  visitId,
  onSaveVoiceNote,
  hasVoiceNote,
  voiceNoteUrl,
}: VoiceNoteRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

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
        setRecordedAudio(audioBlob)

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Errore accesso microfono:', error)
      alert('Permesso microfono negato. Abilita nel browser.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const playAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const saveRecording = () => {
    if (recordedAudio) {
      onSaveVoiceNote(visitId, recordedAudio)
      setRecordedAudio(null)
    }
  }

  const deleteRecording = () => {
    setRecordedAudio(null)
  }

  const deleteExistingNote = () => {
    // Call delete function
    onSaveVoiceNote(visitId, new Blob()) // Empty blob = delete
  }

  const recordingVariants = {
    initial: { scale: 1 },
    recording: {
      scale: [1, 1.2, 1],
      transition: { duration: 0.6, repeat: Infinity }
    }
  }

  return (
    <div className="space-y-2">
      {/* Recording Controls */}
      <AnimatePresence>
        {!hasVoiceNote && !recordedAudio && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex gap-2"
          >
            {!isRecording ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startRecording}
                className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-lg hover:shadow-lg hover:shadow-red-500/50 transition-all"
              >
                <Mic className="h-4 w-4" />
                Registra nota vocale
              </motion.button>
            ) : (
              <motion.button
                variants={recordingVariants}
                initial="initial"
                animate="recording"
                whileTap={{ scale: 0.95 }}
                onClick={stopRecording}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white text-xs rounded-lg animate-pulse"
              >
                <Square className="h-4 w-4" />
                In registrazione...
              </motion.button>
            )}
          </motion.div>
        )}

        {/* Recorded/Existing Audio Controls */}
        {(recordedAudio || hasVoiceNote) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex gap-2 items-center bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800"
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
              onClick={playAudio}
              className="p-2 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-lg transition-colors"
              title={isPlaying ? 'Pausa' : 'Riproduci'}
            >
              <Play className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </motion.button>

            {recordedAudio && (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={saveRecording}
                  className="px-3 py-1 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Send className="h-3 w-3 inline mr-1" />
                  Salva
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={deleteRecording}
                  className="px-3 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Trash2 className="h-3 w-3 inline mr-1" />
                  Scarta
                </motion.button>
              </>
            )}

            {hasVoiceNote && !recordedAudio && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={deleteExistingNote}
                className="ml-auto px-3 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                title="Elimina nota vocale"
              >
                <Trash2 className="h-3 w-3" />
              </motion.button>
            )}

            <span className="text-xs text-purple-600 dark:text-purple-400">
              🎙️ Nota vocale
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
