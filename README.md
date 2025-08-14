# FinFlow Advanced — Financial Analyzer & PPT Generator

Now with:
- **PDF extraction** (serverless API with `pdf-parse`)
- **Multi-company benchmarking** and comparison charts
- **Custom branding** (colors + logo on slides)
- **AI insights** (via `/api/narrate` and OpenAI-compatible API)

## Quickstart
```bash
npm i
npm run dev
```

## Deploy to Vercel
1. Push this folder to GitHub.
2. New Project → Import → Next.js auto-detected → Deploy.
3. (Optional) Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in Vercel Project → Settings → Environment Variables.
4. Redeploy.

## Data Format
Columns can include:
- Year, Company, Revenue, COGS, Gross Profit (optional), Net Income,
  Current Assets, Current Liabilities, Inventory, Total Assets, Equity.

Column names are normalized from common variants (e.g., Sales → Revenue). If **Company** is missing, the uploader infers it from the filename.

## PDF Parsing
Upload PDF files; the API extracts text and heuristically builds a table. Accuracy varies by formatting. For high-fidelity tables, prefer CSV/XLSX.

## AI Insights
Click **Generate AI Insights** to call `/api/narrate`. Provide `OPENAI_API_KEY`. Model defaults to `gpt-4o-mini` (override with `OPENAI_MODEL`).

## Branding
Use the **Brand Theme** controls to set primary/secondary colors and upload a logo. The PPT will include a top brand bar and logo on the title slide.

## License
MIT
