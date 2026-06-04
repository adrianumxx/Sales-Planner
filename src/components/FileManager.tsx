import React, { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Upload, Trash2 } from 'lucide-react'

interface FileManagerProps {
  hasData: boolean
  onUpload: (file: File) => void
  onClear: () => void
}

export function FileManager({ hasData, onUpload, onClear }: FileManagerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUpload(file)
      setIsOpen(false)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClear = () => {
    onClear()
    setIsOpen(false)
  }

  return (
    <div className="relative">
      {/* Main Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transition-all"
        title="Manage files"
      >
        <Plus className="h-5 w-5" />
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40"
            />

            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="absolute top-full right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50"
            >
              {/* Upload Option */}
              <motion.button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-700/50 transition-colors text-left group"
                whileHover={{ x: 2 }}
              >
                <Upload className="h-5 w-5 text-cyan-400 group-hover:text-cyan-300" />
                <div>
                  <p className="font-medium text-white">Upload file</p>
                  <p className="text-xs text-slate-400">New customer file</p>
                </div>
              </motion.button>

              {/* Divider */}
              {hasData && <div className="h-px bg-slate-700" />}

              {/* Clear Option */}
              {hasData && (
                <motion.button
                  onClick={handleClear}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-500/10 transition-colors text-left group"
                  whileHover={{ x: 2 }}
                >
                  <Trash2 className="h-5 w-5 text-red-400 group-hover:text-red-300" />
                  <div>
                    <p className="font-medium text-white">Clear data</p>
                    <p className="text-xs text-slate-400">Delete current plan</p>
                  </div>
                </motion.button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
