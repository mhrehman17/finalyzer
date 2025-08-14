'use client'
import { useState, useEffect } from 'react'

export type Theme = { primary: string; secondary: string; logoDataUrl?: string | null }

export default function ThemePicker({ onChange }: { onChange:(t:Theme)=>void }) {
  const [primary, setPrimary] = useState('#0ea5e9')
  const [secondary, setSecondary] = useState('#0284c7')
  const [logo, setLogo] = useState<string | null>(null)

  useEffect(()=>{ onChange({ primary, secondary, logoDataUrl: logo }) }, [primary, secondary, logo])

  const handleLogo = (f: File | null) => {
    if (!f) return setLogo(null)
    const reader = new FileReader()
    reader.onload = e => setLogo(String(e.target?.result || ''))
    reader.readAsDataURL(f)
  }

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <h3 className="font-semibold">Brand Theme</h3>
      <div className="flex gap-4 items-center">
        <label className="text-sm">Primary</label>
        <input type="color" value={primary} onChange={e=>setPrimary(e.target.value)} />
        <label className="text-sm">Secondary</label>
        <input type="color" value={secondary} onChange={e=>setSecondary(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <input type="file" accept="image/*" onChange={e=>handleLogo(e.target.files?.[0] || null)} />
        {logo && <img src={logo} alt="logo" className="h-8" />}
      </div>
    </div>
  )
}
