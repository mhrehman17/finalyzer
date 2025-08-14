import React, { useState } from 'react'
import { parseCsv, parseXlsx, parsePdf } from './parsers' // make sure these exist
import { normalizeRows } from './utils' // your normalization function
import { generateAiInsights } from './aiService' // your AI service

type Row = { [key: string]: any }
type FileEntry = { file: File; rows: Row[] }

const Uploader: React.FC = () => {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [aiInsights, setAiInsights] = useState<any>(null)
  const [error, setError] = useState<string>('')

  const handleFiles = async (fileList: FileList | null) => {
    setError('')
    if (!fileList || fileList.length === 0) return

    const newEntries: FileEntry[] = []

    for (const file of Array.from(fileList)) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      try {
        let parsed: Row[] = []

        if (ext === 'csv') parsed = await parseCsv(file)
        else if (ext === 'xlsx' || ext === 'xls') parsed = await parseXlsx(file)
        else if (ext === 'pdf') parsed = await parsePdf(file)
        else throw new Error('Unsupported file type. Please upload CSV, XLSX, or PDF.')

        const companyName = file.name.replace(/\.[^.]+$/, '')
        const normalized = normalizeRows(parsed, companyName).filter(r => Object.keys(r).length > 0)
        normalized.forEach(r => { if (!r['Company']) r['Company'] = companyName })

        newEntries.push({ file, rows: normalized })
      } catch (e: any) {
        setError(`Failed to parse ${file.name}: ${e.message || e}`)
      }
    }

    setFiles(prev => {
      const updatedFiles = [...prev, ...newEntries]
      if (updatedFiles.length > prev.length) setAiInsights(null) // clear AI insights
      return updatedFiles
    })
  }

  const handleGenerateAi = async () => {
    try {
      const allRows = files.flatMap(f => f.rows)
      const insights = await generateAiInsights(allRows)
      setAiInsights(insights)
    } catch (e: any) {
      setError(`AI generation failed: ${e.message || e}`)
    }
  }

  const handleExportPpt = () => {
    // implement your PPT export logic here
    console.log('Exporting PPT...')
  }

  return (
    <div className="uploader">
      <input type="file" multiple onChange={e => handleFiles(e.target.files)} />
      {error && <div className="error">{error}</div>}

      <button onClick={handleGenerateAi} disabled={files.length === 0}>Generate AI Insights</button>
      <button onClick={handleExportPpt} disabled={!aiInsights}>Export PPT</button>

      <div className="file-preview">
        {files.map(f => (
          <div key={f.file.name}>
            <strong>{f.file.name}</strong> ({f.rows.length} rows)
          </div>
        ))}
      </div>

      {aiInsights && (
        <div className="ai-insights">
          <h3>AI Insights:</h3>
          <pre>{JSON.stringify(aiInsights, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

export default Uploader
