'use client'
import { useEffect, useRef } from 'react'
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Legend,
  Tooltip
} from 'chart.js'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Legend, Tooltip)

type Props = {
  id: string
  labels: (string|number)[]
  datasets: { label: string, data: number[] }[]
  title: string
  onReady?: (dataUrl: string) => void
}

export default function ChartCanvas({ id, labels, datasets, title, onReady }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const ctx = ref.current.getContext('2d')
    if (!ctx) return
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map(d => ({ ...d, fill:false, tension:0.2 }))
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: title },
          legend: { display: true }
        },
        scales: { y: { beginAtZero: false } }
      }
    })
    const url = ref.current.toDataURL('image/png')
    onReady && onReady(url)
    return () => chart.destroy()
  }, [id, JSON.stringify(labels), JSON.stringify(datasets), title])

  return <canvas id={id} ref={ref} className="w-full h-64" />
}
