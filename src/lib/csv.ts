import type { HistoryEntry } from './db'
import { at } from './numbers'

function escapeCell(value: string): string {
  /* A cell beginning =, +, - or @ is a formula to Excel and LibreOffice, so a product named
   * `=HYPERLINK(...)` would turn this export into an outbound request carrying the shop's own
   * cost figures the moment it was opened. Prefixing an apostrophe makes it literal text.
   * Reachable through a restored backup, which accepts any name string. */
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Build a CSV export (with UTF-8 BOM so Excel renders Persian text correctly). */
export function buildHistoryCsv(entries: HistoryEntry[], headers: string[], modeLabels: Record<string, string>): string {
  const rows = [headers.map(escapeCell).join(',')]
  for (const e of entries) {
    rows.push(
      [
        new Date(e.createdAt).toISOString(),
        modeLabels[e.mode] ?? e.mode,
        String(at(e.inputs, 0)),
        String(at(e.inputs, 1)),
        String(at(e.results, 0)),
        String(at(e.results, 1)),
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
