'use client'
import { useState } from 'react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import PptxGenJS from 'pptxgenjs'
import ChartCanvas from './ChartCanvas'
import ThemePicker, { Theme } from './ThemePicker'
import { normalizeRows, groupByCompany, generateHeuristicInsights, Row } from '@/lib/analysis'
import { buildBenchmarkNarrative } from '@/lib/bench'

type FileEntry = { file: File, rows: Row[] }

async function parseCsv(file: File): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      complete: (res) => resolve(res.data as Row[]),
      error: reject
    })
  })
}
async function parseXlsx(file: File): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws) as Row[]
        resolve(json)
      } catch (e) { reject(e) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

async function parsePdf(file: File): Promise<Row[]> {
  const fd = new FormData()
  fd.append('file', file)
  // Use filename (without extension) as company hint
  fd.append('company', file.name.replace(/\.[^.]+$/, ''))
  const r = await fetch('/api/parse-pdf', { method: 'POST', body: fd })
  if (!r.ok) throw new Error(await r.text())
  const j = await r.json()
  return j.rows as Row[]
}

export default function Uploader() {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [error, setError] = useState<string>('')
  const [theme, setTheme] = useState<Theme>({ primary: '#0ea5e9', secondary: '#0284c7', logoDataUrl: null })
  const [aiInsights, setAiInsights] = useState<string[]|null>(null)
  const [loadingAI, setLoadingAI] = useState(false)

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
        const companyName = (file.name.replace(/\.[^.]+$/, ''))
        const normalized = normalizeRows(parsed, companyName).filter(r => Object.keys(r).length > 0)
        // Ensure Company if missing
        normalized.forEach(r => { if (!r['Company']) r['Company'] = companyName })
        newEntries.push({ file, rows: normalized })
      } catch (e:any) {
        setError(`Failed to parse ${file.name}: ${e.message || e}`)
      }
    }
    setFiles(prev => [...prev, ...newEntries])
  }

  const allRows = files.flatMap(f => f.rows)
  const companies = groupByCompany(allRows)

  const years = Array.from(new Set(allRows.map(r=>Number(r['Year']||'')).filter(v=>!Number.isNaN(v)))).sort((a,b)=>a-b)
  const companySeries = companies.map(c => ({
    name: c.company,
    revenue: years.map(y => Number(c.rows.find(r=>Number(r['Year'])===y)?.['Revenue'] ?? 0)),
    netIncome: years.map(y => Number(c.rows.find(r=>Number(r['Year'])===y)?.['Net Income'] ?? 0)),
    netMargin: years.map(y => Number(c.rows.find(r=>Number(r['Year'])===y)?.['Net Margin'] ?? 0)*100)
  }))

  const buildPPT = async () => {
    if (allRows.length===0) return
    const pptx = new PptxGenJS()
    pptx.layout = '16x9'
    const title = 'Financial Analysis Report'
    const sub = 'Auto-generated with FinFlow Advanced'

    const brandPrimary = theme.primary
    const brandSecondary = theme.secondary

    // Title slide
    let slide = pptx.addSlide()
    slide.background = { color: 'FFFFFF' }
    slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:10, h:0.6, fill: { color: brandPrimary }})
    slide.addText(title, { x:0.8, y:1.2, w:8, h:1, fontSize:32, bold:true, color:'000000' })
    slide.addText(sub, { x:0.8, y:2.1, w:8, fontSize:18, color:'666666' })
    if (theme.logoDataUrl) slide.addImage({ data: theme.logoDataUrl, x:8, y:0.2, w:1.6, h:0.6, sizing: { type: 'contain', w:1.6, h:0.6 } })

    // Summary table per company
    for (const c of companies) {
      slide = pptx.addSlide()
      slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:10, h:0.3, fill: { color: brandSecondary }})
      slide.addText(`${c.company} — Summary`, { x:0.5, y:0.4, fontSize:24, bold:true })
      const headers = ['Year','Revenue','COGS','Gross Profit','Net Income','Current Assets','Current Liabilities','Inventory','Total Assets','Equity','Gross Margin','Net Margin','Current Ratio','Quick Ratio','ROA','ROE']
      const table = [headers]
      const sorted = [...c.rows].sort((a:any,b:any)=>Number(a['Year']||0)-Number(b['Year']||0))
      for (const r of sorted) {
        table.push(headers.map(h => {
          const v:any = r[h]
          if (typeof v === 'number' && ['Gross Margin','Net Margin','ROA','ROE'].includes(h)) return (v*100).toFixed(2)+'%'
          if (typeof v === 'number') return Number.isInteger(v) ? v : v.toFixed(2)
          return v ?? ''
        }))
      }
      slide.addTable(table, { x:0.5, y:1.0, w:9.0, fontSize:10 })
    }

    // Benchmark slide
    slide = pptx.addSlide()
    slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:10, h:0.3, fill: { color: brandSecondary }})
    slide.addText('Benchmarking Overview', { x:0.5, y:0.4, fontSize:24, bold:true })
    const benchLines = buildBenchmarkNarrative(allRows)
    slide.addText(benchLines.map(l=>'• '+l).join('\n'), { x:0.6, y:1.0, w:9, h:4, fontSize:16, lineSpacing:20 })

    // Charts per company
    for (const s of companySeries) {
      // revenue
      slide = pptx.addSlide()
      slide.addText(`${s.name} — Revenue Trend`, { x:0.5, y:0.3, fontSize:24, bold:true })
      slide.addChart(pptx.ChartType.line, [
        { name: 'Revenue', labels: years, values: s.revenue }
      ], { x:0.5, y:1.0, w:9, h:4 })
      // net income & margin
      slide = pptx.addSlide()
      slide.addText(`${s.name} — Net Income & Net Margin`, { x:0.5, y:0.3, fontSize:24, bold:true })
      slide.addChart(pptx.ChartType.line, [
        { name: 'Net Income', labels: years, values: s.netIncome },
        { name: 'Net Margin %', labels: years, values: s.netMargin }
      ], { x:0.5, y:1.0, w:9, h:4 })
    }

    // Insights (AI or heuristic)
    const insights = aiInsights ?? generateHeuristicInsights(allRows)
    slide = pptx.addSlide()
    slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:10, h:0.3, fill: { color: brandSecondary }})
    slide.addText('Insights', { x:0.5, y:0.4, fontSize:24, bold:true })
    slide.addText(insights.map(i=>'• '+i).join('\n'), { x:0.6, y:1.0, w:9, h:4, fontSize:16, lineSpacing:20 })

    await pptx.writeFile({ fileName: 'Financial_Report_Advanced.pptx' })
  }

  const generateAI = async () => {
    setLoadingAI(true)
    try {
      const summary = {
        companies: companies.map(c=>c.company),
        years,
        metrics: companySeries.map(s => ({
          company: s.name,
          lastRevenue: s.revenue.at(-1),
          lastNetIncome: s.netIncome.at(-1),
          avgNetMarginPct: Math.round((s.netMargin.reduce((a,b)=>a+b,0)/(s.netMargin.length||1))*100)/100
        }))
      }
      const prompt = `Create bullet-point insights for a board-ready deck. Use specific numbers and compare companies where relevant. Data summary: ${JSON.stringify(summary)}`
      const r = await fetch('/api/narrate', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ prompt }) })
      if (!r.ok) throw new Error(await r.text())
      const j = await r.json()
      const text: string = j.text || ''
      const bullets = text.split(/\n|•/).map(s=>s.trim()).filter(Boolean)
      setAiInsights(bullets)
    } catch (e:any) {
      setAiInsights(null)
      alert(`AI generation failed: ${e.message || e}`)
    } finally {
      setLoadingAI(false)
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="rounded-2xl shadow p-6 border space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">FinFlow Advanced</h1>
            <p className="text-gray-600">Upload multiple CSV/XLSX/PDF files. Analyze multi-company data, benchmark, brand, and export PPT.</p>
          </div>
        </div>

        <ThemePicker onChange={setTheme} />

        <div className="rounded-xl border p-4 space-y-2">
          <h2 className="text-xl font-semibold">Upload Financial Statements</h2>
          <input multiple type="file" accept=".csv,.xlsx,.xls,.pdf" onChange={(e)=>handleFiles(e.target.files)} />
          {error && <p className="text-red-600">{error}</p>}
          {files.length>0 && (
            <ul className="text-sm text-gray-600 list-disc pl-5">
              {files.map((f,i)=>(<li key={i}>{f.file.name} — {f.rows.length} rows</li>))}
            </ul>
          )}
        </div>

        {allRows.length>0 && (
          <div className="grid gap-6">
            <div className="rounded-xl border p-4">
              <h2 className="text-xl font-semibold mb-2">Revenue by Company</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {companySeries.map(s => (
                  <div className="rounded-lg border p-3" key={s.name}>
                    <ChartCanvas id={`rev-${s.name}`} labels={years} datasets={[{label:`${s.name} Revenue`, data:s.revenue}]} title={`${s.name} Revenue`} />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <h2 className="text-xl font-semibold mb-2">Net Income & Margin</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {companySeries.map(s => (
                  <div className="rounded-lg border p-3" key={s.name}>
                    <ChartCanvas id={`ni-${s.name}`} labels={years} datasets={[
                      {label:`${s.name} Net Income`, data:s.netIncome},
                      {label:`${s.name} Net Margin %`, data:s.netMargin}
                    ]} title={`${s.name} Net Income & Margin`} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={generateAI} className="px-4 py-2 rounded-xl shadow bg-brand text-white disabled:opacity-50" disabled={loadingAI}>
                {loadingAI ? 'Generating AI Insights…' : 'Generate AI Insights'}
              </button>
              <button onClick={buildPPT} className="px-4 py-2 rounded-xl shadow bg-black text-white">Download Branded PowerPoint</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
