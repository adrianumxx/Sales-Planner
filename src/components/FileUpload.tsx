import React, { useRef } from 'react'
import { Upload, AlertCircle } from 'lucide-react'
import { useFileParser } from '../hooks/useFileParser'
import type { Client } from '../types'

interface FileUploadProps {
  onUpload: (clients: Client[]) => void
}

export function FileUpload({ onUpload }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { parseCSV, loading, error } = useFileParser()

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

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

    const result = await parseCSV(file)
    if (result.success && result.data) {
      onUpload(result.data)
    }
  }

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      await handleFile(e.target.files[0])
    }
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
      className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 transition"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleInputChange}
        className="hidden"
      />

      <Upload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
        Upload Sales Data
      </h3>
      <p className="text-slate-500 dark:text-slate-400 mb-4">
        Drag and drop your CSV file here or click to select
      </p>

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
      >
        {loading ? 'Processing...' : 'Select File'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800 dark:text-red-200">{error}</div>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-600">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Expected columns: Quality, CustomerDetails, Town, DaysSinceLastVisit
        </p>
      </div>
    </div>
  )
}
