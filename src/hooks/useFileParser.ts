import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
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

  const parseData = useCallback((rows: (string | number | boolean | null)[][]): ParseResult => {
    if (!rows || rows.length < 2) {
      return { success: false, error: 'File is empty or has insufficient rows' }
    }

    try {
      let dataRows = rows

      // Skip period/metadata row if present
      if (dataRows[0][0]?.toString().toLowerCase().includes('period')) {
        dataRows = dataRows.slice(1)
      }

      const header = dataRows[0].map(h => String(h || '').trim().toLowerCase())
      const normalizedHeader = header.map(normalizeColumnName)

      // Map flexible column names
      const clientNameIdx = normalizedHeader.findIndex(h => h.includes('client') || h.includes('name') || h.includes('customer') || h.includes('account'))
      const townIdx = normalizedHeader.findIndex(h => h.includes('town') || h.includes('city') || h.includes('location') || h.includes('area'))
      const daysIdx = normalizedHeader.findIndex(h =>
        (h.includes('days') || h.includes('last') || h.includes('visit')) &&
        (h.includes('days') || h.includes('visit'))
      )

      if (clientNameIdx === -1 || townIdx === -1 || daysIdx === -1) {
        return {
          success: false,
          error: `Missing required columns. Found: ${header.join(', ')}`
        }
      }

      const clients: Client[] = []
      for (let i = 1; i < dataRows.length; i++) {
        const row = dataRows[i]
        if (!row || row.length <= Math.max(clientNameIdx, townIdx, daysIdx)) continue

        const clientName = String(row[clientNameIdx] || '').trim()
        const town = String(row[townIdx] || '').trim()
        const daysStr = String(row[daysIdx] || '0').trim()
        const lastVisitDays = Math.round(parseFloat(daysStr)) || 0

        if (clientName && town && lastVisitDays > 0) {
          clients.push({
            id: Math.random().toString(36).substr(2, 9),
            clientName,
            town,
            lastVisitDays,
            urgency: 'ok',
          })
        }
      }

      if (clients.length === 0) {
        return { success: false, error: 'No valid client records found' }
      }

      return { success: true, data: clients }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown parsing error'
      return { success: false, error: message }
    }
  }, [])

  const parseFile = useCallback((file: File): Promise<ParseResult> => {
    return new Promise((resolve) => {
      setLoading(true)
      setError(null)

      try {
        const reader = new FileReader()

        reader.onload = (e) => {
          try {
            const data = e.target?.result
            let rows: (string | number | boolean | null)[][] = []

            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
              // Parse Excel file
              const workbook = XLSX.read(data, { type: 'array' })
              const sheetName = workbook.SheetNames[0]
              const sheet = workbook.Sheets[sheetName]
              const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 0, defval: '' })

              // Convert to array format with proper types
              const rowsData = jsonData as Record<string, unknown>[]
              if (rowsData.length > 0) {
                const headers = Object.keys(rowsData[0])
                rows = [
                  headers as (string | number | boolean | null)[],
                  ...rowsData.map(row =>
                    headers.map(h => {
                      const val = row[h]
                      if (val === null || val === undefined) return null
                      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val
                      return String(val)
                    })
                  )
                ]
              }
            } else {
              // Parse CSV file
              const text = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer)
              const lines = text.split('\n').filter(line => line.trim())
              rows = lines.map(line => line.split(';').map(v => v.trim().replace(/"/g, '')))
            }

            const result = parseData(rows)
            if (!result.success) {
              setError(result.error || 'Unknown error')
            }
            setLoading(false)
            resolve(result)
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to parse file'
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

        reader.readAsArrayBuffer(file)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        setLoading(false)
        resolve({ success: false, error: message })
      }
    })
  }, [parseData])

  return { parseFile, loading, error }
}
