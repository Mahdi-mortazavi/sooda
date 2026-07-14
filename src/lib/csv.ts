import type { HistoryEntry } from './db'

function escapeCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Build a CSV export (with UTF-8 BOM so Excel renders Persian text correctly). */
export function buildHistoryCsv(entries: HistoryEntry[], headers: string[], modeLabels: Record<string, string>): string {
  const rows = [headers.map(escapeCell).join(',')]
  for (const e of entries) {
    rows.push(
      [
        new Date(e.createdAt).toISOString(),
        modeLabels[e.mode] ?? e.mode,
        String(e.inputs[0]),
        String(e.inputs[1]),
        String(e.results[0]),
        String(e.results[1]),
        e.unit && e.unit !== 'none' ? e.unit : '',
      ]
        .map(escapeCell)
        .join(','),
    )
  }
  return '﻿' + rows.join('\n')
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
