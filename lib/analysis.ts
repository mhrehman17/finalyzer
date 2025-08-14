export type Row = Record<string, number | string>;
export type Theme = { primary: string; secondary: string; logoDataUrl?: string | null };
export type CompanyRows = { company: string; rows: Row[] };

export function toNumber(val: any): number | undefined {
  if (val === null || val === undefined || val === '') return undefined
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[,\s]/g, ''))
  return Number.isNaN(n) ? undefined : n
}

export function normalizeRows(rows: Row[], companyHint?: string): Row[] {
  const map: Record<string,string> = {
    'year':'Year','fiscal year':'Year','period':'Year',
    'revenue':'Revenue','sales':'Revenue','turnover':'Revenue',
    'cogs':'COGS','cost of goods sold':'COGS',
    'gross profit':'Gross Profit',
    'net income':'Net Income','profit':'Net Income','earnings':'Net Income',
    'current assets':'Current Assets',
    'current liabilities':'Current Liabilities',
    'inventory':'Inventory',
    'total assets':'Total Assets',
    'shareholders\' equity':'Equity','equity':'Equity','shareholders equity':'Equity',
    'company':'Company','entity':'Company','brand':'Company'
  };

  const outRows: Row[] = rows.map(r => {
    const out: Row = {}
    for (const [k,v] of Object.entries(r)) {
      const ck = k.trim().toLowerCase()
      const canonical = Object.prototype.hasOwnProperty.call(map, ck) ? map[ck] : k
      out[canonical] = v
    }
    if (!out['Company'] && companyHint) out['Company'] = companyHint

    const rev = toNumber(out['Revenue'])
    const cogs = toNumber(out['COGS'])
    if (out['Gross Profit'] === undefined && rev !== undefined && cogs !== undefined) out['Gross Profit'] = rev - cogs

    if (rev !== undefined) {
      const gp = toNumber(out['Gross Profit'])
      const ni = toNumber(out['Net Income'])
      if (gp !== undefined) out['Gross Margin'] = gp / rev
      if (ni !== undefined) out['Net Margin'] = ni / rev
    }

    const ca = toNumber(out['Current Assets'])
    const cl = toNumber(out['Current Liabilities'])
    if (ca !== undefined && cl !== undefined && cl !== 0) {
      const inv = toNumber(out['Inventory']) ?? 0
      out['Current Ratio'] = ca / cl
      out['Quick Ratio'] = (ca - inv) / cl
    }

    const ni = toNumber(out['Net Income'])
    const ta = toNumber(out['Total Assets'])
    const eq = toNumber(out['Equity'])
    if (ni !== undefined && ta) out['ROA'] = ni / ta
    if (ni !== undefined && eq) out['ROE'] = ni / eq

    return out
  })

  // ensure Year is numeric
  outRows.forEach(r => {
    const y = r['Year']
    if (y && typeof y !== 'number') {
      const n = parseInt(String(y).replace(/[^0-9]/g,''), 10)
      if (!Number.isNaN(n)) r['Year'] = n
    }
  })

  return outRows
}

export function groupByCompany(rows: Row[]): CompanyRows[] {
  const groups = new Map<string, Row[]>()
  for (const r of rows) {
    const c = String(r['Company'] || 'Company A')
    if (!groups.has(c)) groups.set(c, [])
    groups.get(c)!.push(r)
  }
  return Array.from(groups.entries()).map(([company, rows]) => ({ company, rows }))
}

export function computeBenchmarks(all: Row[]) {
  // Simple aggregations per company and overall percentiles
  const byCompany = groupByCompany(all).map(({company, rows}) => {
    const sorted = [...rows].sort((a:any,b:any)=>Number(a['Year']||0)-Number(b['Year']||0))
    const first = sorted[0] || {}
    const last = sorted[sorted.length-1] || {}
    const rev0 = toNumber(first['Revenue']) ?? 0
    const revN = toNumber(last['Revenue']) ?? 0
    const ni0 = toNumber(first['Net Income']) ?? 0
    const niN = toNumber(last['Net Income']) ?? 0
    const years = sorted.map(r=>Number(r['Year']||0)).filter(v=>!Number.isNaN(v))
    const periods = Math.max(1, (years.length-1))
    const cagr = rev0>0 && revN>0 ? Math.pow(revN/rev0, 1/periods)-1 : 0
    const avgMargin = average(sorted.map(r => (toNumber(r['Net Margin']) ?? 0)))
    const currRatio = last['Current Ratio'] ? Number(last['Current Ratio']) : undefined
    return { company, cagr, avgMargin, currRatio, revN, niN }
  })

  const cagrValues = byCompany.map(b=>b.cagr).sort((a,b)=>a-b)
  const marginValues = byCompany.map(b=>b.avgMargin).sort((a,b)=>a-b)
  function pct(arr:number[], p:number){ if(arr.length===0) return 0; const i=Math.floor(p*(arr.length-1)); return arr[i] }

  return {
    byCompany,
    percentiles: {
      cagr: { p25: pct(cagrValues,0.25), p50: pct(cagrValues,0.5), p75: pct(cagrValues,0.75) },
      margin: { p25: pct(marginValues,0.25), p50: pct(marginValues,0.5), p75: pct(marginValues,0.75) }
    }
  }
}

function average(nums:number[]) { if (nums.length===0) return 0; return nums.reduce((a,b)=>a+b,0)/nums.length }

export function generateHeuristicInsights(rows: Row[]): string[] {
  const insights: string[] = []
  const sorted = [...rows].sort((a:any,b:any)=>Number(a['Year']||0)-Number(b['Year']||0))
  if (sorted.length >= 2) {
    const first = sorted[0], last = sorted[sorted.length - 1];
    const r0 = toNumber(first['Revenue']) ?? 0
    const rn = toNumber(last['Revenue']) ?? 0
    if (r0 && rn) {
      const cagr = Math.pow(rn / r0, 1 / (sorted.length - 1)) - 1;
      insights.push(`Revenue CAGR over period: ${(cagr*100).toFixed(2)}%`);
    }
    const n0 = toNumber(first['Net Income']) ?? 0
    const nn = toNumber(last['Net Income']) ?? 0
    if (n0 && nn) {
      const chg = (nn - n0) / (Math.abs(n0) || 1);
      insights.push(`Net Income change: ${(chg*100).toFixed(2)}%`);
    }
  }
  const marginDrop = sorted.some((r,i,arr) => i>0 && (toNumber(r['Net Margin']) ?? 0) < (toNumber(arr[i-1]['Net Margin']) ?? 0));
  if (marginDrop) insights.push('Warning: Net margin declined in the period.');
  const liquidityLow = sorted.some(r => (toNumber(r['Current Ratio']) ?? 1.5) < 1.0);
  if (liquidityLow) insights.push('Liquidity risk: Current ratio fell below 1.0 in at least one period.');
  if (insights.length===0) insights.push('No major anomalies detected; stable performance.');
  return insights;
}
