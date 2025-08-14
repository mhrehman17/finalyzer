import './globals.css'
import { ReactNode } from 'react'

export const metadata = {
  title: 'FinFlow Advanced — Financial Analyzer',
  description: 'Analyze multi-company financials, PDF parsing, AI narratives, and export branded PPTX.'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
