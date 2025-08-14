import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest){
  const body = await req.json()
  const { prompt, provider = 'openai', model = process.env.OPENAI_MODEL || 'gpt-4o-mini' } = body
  if (!prompt) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })

  if (provider === 'openai') {
    const key = process.env.OPENAI_API_KEY
    if (!key) return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 400 })
    // minimal chat completions compatibility
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a financial analyst. Write concise, bullet-style insights with specific metrics and cautions. Avoid hedging.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4
      })
    })
    if (!r.ok) {
      const err = await r.text()
      return NextResponse.json({ error: err }, { status: r.status })
    }
    const j = await r.json()
    const text = j.choices?.[0]?.message?.content || ''
    return NextResponse.json({ text })
  }

  return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 })
}
