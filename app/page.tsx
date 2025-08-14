import Uploader from '/components/Uploader'
import { FileText } from 'lucide-react'

export default function Page() {
  return (
    <main className="p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 flex items-center gap-3">
          <FileText />
          <h1 className="text-2xl font-bold">FinFlow Advanced — Analyzer & PPT Generator</h1>
        </header>
        <Uploader />
        <footer className="text-xs text-gray-500 mt-12">
          Built with Next.js, Chart.js, PptxGenJS. PDF parsing via serverless API. Optional AI insights via OpenAI.
        </footer>
      </div>
    </main>
  )
}
