import { useState, useCallback } from 'react'
import type { Client } from '../types'

interface ParseResult {
  success: boolean
  data?: Client[]
  error?: string
}

export function useFileParser() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parseCSV = useCallback((file: File): Promise<ParseResult> => {
    return new Promise((resolve) => {
      setLoading(true)
      setError(null)

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          const lines = text.split('\n').filter(line => line.trim())

          if (lines.length < 2) {
            throw new Error('CSV file is empty or has insufficient rows')
          }

          const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
          const requiredColumns = ['quality', 'customerdetails', 'town', 'dayssincelastvisit']

          const missingCols = requiredColumns.filter(col => !header.includes(col))
          if (missingCols.length > 0) {
            throw new Error(`Missing required columns: ${missingCols.join(', ')}`)
          }

          const qualityIdx = header.indexOf('quality')
          const detailsIdx = header.indexOf('customerdetails')
          const townIdx = header.indexOf('town')
          const daysIdx = header.indexOf('dayssincelastvisit')

          const clients: Client[] = []
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
            if (values.length <= Math.max(qualityIdx, detailsIdx, townIdx, daysIdx)) continue

            const quality = parseInt(values[qualityIdx]) || 0
            const customerDetails = values[detailsIdx] || ''
            const town = values[townIdx] || ''
            const daysSinceLastVisit = parseInt(values[daysIdx]) || 0

            if (customerDetails && town) {
              clients.push({ quality, customerDetails, town, daysSinceLastVisit })
            }
          }

          if (clients.length === 0) {
            throw new Error('No valid client records found in CSV')
          }

          setLoading(false)
          resolve({ success: true, data: clients })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown parsing error'
          setError(message)
          setLoading(false)
          resolve({ success: false, error: message })
        }
      }

      reader.onerror = () => {
        const message = 'Failed to read file'
        setError(message)
        setLoading(false)
        resolve({ success: false, error: message })
      }

      reader.readAsText(file)
    })
  }, [])

  return { parseCSV, loading, error }
}
