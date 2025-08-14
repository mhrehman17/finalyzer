import { Row, groupByCompany, computeBenchmarks } from './analysis'

export function buildBenchmarkNarrative(all: Row[]) {
  const { byCompany, percentiles } = computeBenchmarks(all)
  const lines: string[] = []
  lines.push(`Benchmarking across ${byCompany.length} companies:`)
  for (const b of byCompany) {
    const posCAGR = position(b.cagr, percentiles.cagr)
    const posMargin = position(b.avgMargin, percentiles.margin)
    lines.push(`${b.company}: CAGR ${fmtPct(b.cagr)} (${posCAGR}), Avg Net Margin ${fmtPct(b.avgMargin)} (${posMargin})`)
  }
  lines.push(`Overall medians — CAGR ${fmtPct(percentiles.cagr.p50)}, Net Margin ${fmtPct(percentiles.margin.p50)}.`)
  return lines
}

function position(v:number, pct:{p25:number,p50:number,p75:number}){
  if (v<=pct.p25) return 'below P25'
  if (v<=pct.p50) return 'P25–P50'
  if (v<=pct.p75) return 'P50–P75'
  return 'above P75'
}
function fmtPct(v:number){ return (v*100).toFixed(2)+'%' }
