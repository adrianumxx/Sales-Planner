import React, { useRef, useState } from 'react'
import { Upload, AlertCircle, CheckCircle2, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { useFileParser } from '../hooks/useFileParser'
import type { Client } from '../types'

interface FileUploadProps {
  onUpload: (clients: Client[]) => void
}

export function FileUpload({ onUpload }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const { parseFile, loading, error } = useFileParser()

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      await handleFile(files[0])
    }
  }

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(csv|xlsx?)$/i)) {
      alert('Please upload a CSV or Excel file')
      return
    }

    const result = await parseFile(file)
    if (result.success && result.data) {
      onUpload(result.data)
    }
  }

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      await handleFile(e.target.files[0])
    }
  }

  const containerVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  }

  const uploadIconVariants = {
    initial: { scale: 0, rotate: -180 },
    animate: {
      scale: 1,
      rotate: 0,
      transition: { type: 'spring', stiffness: 100, damping: 15 }
    },
    hover: {
      y: -8,
      transition: { type: 'spring', stiffness: 400, damping: 10 }
    },
  }

  const dragOverVariants = {
    initial: {
      backgroundColor: 'transparent',
      borderColor: 'var(--border)',
      scale: 1,
    },
    dragActive: {
      backgroundColor: 'rgba(99, 102, 241, 0.05)',
      borderColor: 'var(--color-accent-glow)',
      scale: 1.02,
      transition: { duration: 0.2 },
    },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      className="w-full"
    >
      <motion.div
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragActive(true)
        }}
        variants={dragOverVariants}
        initial="initial"
        animate={dragActive ? 'dragActive' : 'initial'}
        className="relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 backdrop-blur-sm bg-gradient-to-br from-slate-50/50 to-transparent dark:from-slate-800/20 dark:to-transparent"
      >
        {/* Animated gradient border on hover */}
        <div className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #00d9ff)',
            padding: '2px',
            borderRadius: 'inherit',
          }}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleInputChange}
          className="hidden"
        />

        <motion.div
          variants={uploadIconVariants}
          initial="initial"
          animate="animate"
          whileHover="hover"
          className="mx-auto mb-6"
        >
          <Upload className="h-16 w-16 text-indigo-600 dark:text-cyan-400 drop-shadow-lg" />
        </motion.div>

        <motion.h3
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-50 dark:to-slate-200 bg-clip-text text-transparent mb-3"
        >
          Upload Sales Data
        </motion.h3>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-slate-600 dark:text-slate-300 mb-6 text-lg"
        >
          Drag and drop your CSV file here or click to select
        </motion.p>

        <motion.button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-500 dark:to-purple-600 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-indigo-500/50 disabled:opacity-50 transition-all duration-300"
        >
          <motion.div
            animate={loading ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 1, repeat: loading ? Infinity : 0 }}
          >
            <Zap className="h-5 w-5" />
          </motion.div>
          {loading ? 'Processing...' : 'Select File'}
        </motion.button>

        {/* Error alert with animation */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl flex items-start gap-3 backdrop-blur-sm"
          >
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800 dark:text-red-200">{error}</div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            ✓ Supports CSV and Excel files  •  ✓ Auto-detects columns  •  ✓ 100% secure (local processing)
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
