import React, { useEffect, useRef, useState } from 'react'
import { Share, FileText, FileDown, CalendarDays, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ExportMenuProps {
  onExportPDF: () => void
  onExportCSV: () => void
  onExportICal: () => void
}

const OPTIONS = [
  {
    key: 'pdf',
    label: 'PDF',
    hint: 'Print / share-ready route sheet',
    icon: FileText,
    color: 'text-rose-600 dark:text-rose-400',
  },
  {
    key: 'csv',
    label: 'CSV',
    hint: 'Spreadsheet of all visits',
    icon: FileDown,
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    key: 'ical',
    label: 'iCal',
    hint: 'Add the plan to your calendar',
    icon: CalendarDays,
    color: 'text-indigo-600 dark:text-indigo-400',
  },
] as const

export function ExportMenu({ onExportPDF, onExportCSV, onExportICal }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handlers: Record<string, () => void> = {
    pdf: onExportPDF,
    csv: onExportCSV,
    ical: onExportICal,
  }

  return (
    <div ref={ref} className="relative">
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium shadow-sm"
        title="Export"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Share className="h-4 w-4" />
        <span className="hidden sm:inline">Export</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            role="menu"
            className="absolute right-0 mt-2 w-60 origin-top-right z-50 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden"
          >
            <div className="px-3 pt-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Export plan as
            </div>
            {OPTIONS.map((opt) => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.key}
                  role="menuitem"
                  onClick={() => {
                    handlers[opt.key]()
                    setOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
                >
                  <span className={`flex-shrink-0 ${opt.color}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {opt.label}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                      {opt.hint}
                    </span>
                  </span>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
