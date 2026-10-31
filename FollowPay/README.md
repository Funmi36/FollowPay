# PayFollow

Payment follow-up assistant for freelancers. Enter an invoice, see how overdue it is,
and get a follow-up email in the right tone: friendly, direct, or firm.

Built with **Next.js 15 (App Router) and TypeScript**.

- **Gemma-powered.** `POST /api/generate` calls a Gemma model through the Google AI Studio API.
  Without an API key the app still works using built-in templates.
- **Private by default.** Saved invoices live in your browser's localStorage only.

## Project layout

```
app/
  layout.tsx            fonts, metadata
  page.tsx              renders <PayFollow />
  globals.css           all styles
  api/generate/route.ts server route that calls Gemma
components/PayFollow.tsx  the whole UI (client component)
lib/invoice.ts          types, overdue maths, tone selection, fallback templates
lib/gemma.ts            prompt building and the Gemma API call (server only)
```

## How the tone is chosen

| Situation | Suggested tone |
|---|---|
| Not yet due, or 1–14 days late, 0 reminders sent | Friendly |
| 15–30 days late, or 1 reminder already sent | Direct |
| 30+ days late, or 2+ reminders already sent | Firm |

The more severe of the two signals wins, and you can override it with the tabs.
Change the thresholds in `stageFor()` in `lib/invoice.ts`.

## Deploy to Vercel

1. Get a free key at https://aistudio.google.com/apikey
2. Push this folder to a GitHub repo, then **Add New → Project** in Vercel and import it.
   Vercel detects Next.js automatically.
   (Or from this folder: `npm i -g vercel && vercel`.)
3. In **Project → Settings → Environment Variables** add:
   - `GEMINI_API_KEY` = your key
   - `GEMMA_MODEL` = `gemma-3-27b-it` (optional; any Gemma model your key can access)
4. Redeploy so the variables apply.

## Run locally

```
npm install
cp .env.example .env.local   # then add your key
npm run dev                  # http://localhost:3000
npm run typecheck
```

## Customising

- Tone instructions live in `TONES` in `lib/gemma.ts`.
- To use a self-hosted Gemma (Ollama, Hugging Face, OpenRouter), replace `callGemma()` in `lib/gemma.ts`; nothing else changes.
