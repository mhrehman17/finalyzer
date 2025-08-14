import { NextRequest, NextResponse } from 'next/server'
import pdf from 'pdf-parse'

export const runtime = 'nodejs' // requires Node for pdf-parse

function extractTableLike(text: string) {
  // Very simple heuristic: split lines, detect rows with many spaces and numbers.
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
  const headersIdx = lines.findIndex(l => /year|revenue|sales|net\s*income|cogs/i.test(l))
  const start = headersIdx >=0 ? headersIdx : 0
  const headerLine = lines[start]
  const headers = headerLine.split(/\s{2,}|\t|,|\s\|\s/).map(h=>h.trim())
  const rows: any[] = []
  for (let i=start+1;i<lines.length;i++){
    const parts = lines[i].split(/\s{2,}|\t|,|\s\|\s/).map(p=>p.trim())
    if (parts.length >= Math.min(3, headers.length)) {
      const obj: any = {}
      for (let j=0;j<Math.min(headers.length, parts.length); j++){
        obj[headers[j]] = parts[j]
      }
      rows.push(obj)
    }
  }
  return { headers, rows }
}

export async function POST(req: NextRequest){
  const form = await req.formData()
  const blob = form.get('file')
  const company = String(form.get('company') || 'Company A')
  if (!(blob instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  const buffer = Buffer.from(await blob.arrayBuffer())
  try {
    const data = await pdf(buffer)
    const t = extractTableLike(data.text)
    // attach company hint for client to normalize
    return NextResponse.json({ headers: t.headers, rows: t.rows, company })
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'PDF parse failed' }, { status: 500 })
  }
}
