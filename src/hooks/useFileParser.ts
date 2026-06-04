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

      // Client / customer name column
      const clientNameIdx = normalizedHeader.findIndex(h =>
        h.includes('customerdetails') || h.includes('client') || h.includes('customer') ||
        h.includes('account') || h.includes('name')
      )
      const townIdx = normalizedHeader.findIndex(h =>
        h.includes('town') || h.includes('city') || h.includes('location') || h.includes('area')
      )

      // CRITICAL: prefer "Days Since Last Visit" over "LastVisitFQ".
      // The recency-in-days value is what drives priority; a date/quarter
      // column like "LastVisitFQ" must never be mistaken for it.
      let daysIdx = normalizedHeader.findIndex(h => h.includes('dayssince'))
      if (daysIdx === -1) daysIdx = normalizedHeader.findIndex(h => h.includes('days') && h.includes('since'))
      if (daysIdx === -1) daysIdx = normalizedHeader.findIndex(h => h.includes('days'))
      if (daysIdx === -1) daysIdx = normalizedHeader.findIndex(h => h.includes('since') && h.includes('visit'))

      const qualityIdx = normalizedHeader.findIndex(h =>
        h.includes('quality') || h.includes('tier') || h.includes('segment') || h.includes('grade')
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

        const rawDetails = String(row[clientNameIdx] || '').trim()
        const town = String(row[townIdx] || '').trim()
        const daysStr = String(row[daysIdx] || '0').trim()
        const lastVisitDays = Math.round(parseFloat(daysStr)) || 0

        // CustomerDetails looks like: "POP CAFE | GRAND ROUTE 25, , 7740, WARCOING"
        // → name = "POP CAFE", address = "GRAND ROUTE 25, 7740, WARCOING"
        const [namePart, ...addrParts] = rawDetails.split('|')
        const clientName = (namePart || '').trim() || rawDetails
        const address = addrParts.join('|')
          .replace(/\s*,\s*(?:,\s*)+/g, ', ') // collapse ", ," empty fields
          .replace(/\s+/g, ' ')
          .trim()

        // Quality tier → numeric weight (Core = top)
        const qualityRaw = qualityIdx !== -1 ? String(row[qualityIdx] || '').trim().toLowerCase() : ''
        const quality = qualityRaw === 'core' ? 9 : qualityRaw === 'develop' ? 6 : 7

        if (clientName && town && lastVisitDays > 0) {
          clients.push({
            id: Math.random().toString(36).substr(2, 9),
            clientName,
            town,
            address: address || undefined,
            customerDetails: rawDetails,
            lastVisitDays,
            daysSinceLastVisit: lastVisitDays,
            quality,
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
              // Parse Excel file as raw rows (header:1) → array of arrays.
              // This avoids key collisions from metadata rows and keeps the
              // real header intact for our flexible column detection.
              const workbook = XLSX.read(data, { type: 'array' })
              const sheetName = workbook.SheetNames[0]
              const sheet = workbook.Sheets[sheetName]
              rows = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                defval: '',
                raw: true,
              }) as (string | number | boolean | null)[][]
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
