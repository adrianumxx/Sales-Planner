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

  const normalizeColumnName = (col: string): string => {
    return col.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
  }

  const parseCSV = useCallback((file: File): Promise<ParseResult> => {
    return new Promise((resolve) => {
      setLoading(true)
      setError(null)

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          let lines = text.split('\n').filter(line => line.trim())

          if (lines.length < 2) {
            throw new Error('CSV file is empty or has insufficient rows')
          }

          // Skip period/metadata row if present
          if (lines[0].toLowerCase().includes('period')) {
            lines = lines.slice(1)
          }

          const header = lines[0].split(';').map(h => h.trim().toLowerCase().replace(/"/g, ''))
          const normalizedHeader = header.map(normalizeColumnName)

          // Map flexible column names
          const qualityIdx = normalizedHeader.findIndex(h => h.includes('quality'))
          const detailsIdx = normalizedHeader.findIndex(h => h.includes('customer') || h.includes('details') || h.includes('name'))
          const townIdx = normalizedHeader.findIndex(h => h.includes('town') || h.includes('city') || h.includes('location'))
          const daysIdx = normalizedHeader.findIndex(h =>
            h.includes('days') && h.includes('last') && h.includes('visit')
          )

          if (qualityIdx === -1 || detailsIdx === -1 || townIdx === -1 || daysIdx === -1) {
            throw new Error(`Missing required columns. Found: ${header.join(', ')}`)
          }

          const clients: Client[] = []
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(';').map(v => v.trim().replace(/"/g, ''))
            if (values.length <= Math.max(qualityIdx, detailsIdx, townIdx, daysIdx)) continue

            const qualityStr = values[qualityIdx] || 'Standard'
            const quality = qualityStr === 'Core' ? 9 : qualityStr === 'Premium' ? 10 : 7
            const customerDetails = values[detailsIdx] || ''
            const town = values[townIdx] || ''
            const daysStr = values[daysIdx] || '0'
            const daysSinceLastVisit = Math.round(parseFloat(daysStr)) || 0

            if (customerDetails && town && daysSinceLastVisit > 0) {
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
