# 🧾 Receipt Snap

Snap a photo of a receipt; AI reads the amount, merchant and category, and logs it to that month's expense tracker.

## Setup

1. **Supabase** (free at supabase.com): create a project, then run `schema.sql` in the SQL Editor. Copy the Project URL and the **service role** key from Settings → API.
2. **OpenAI**: get an API key from platform.openai.com.
3. Configure:
   ```bash
   cp .env.example .env
   # then edit .env with your keys
   ```
4. Run:
   ```bash
   npm install
   npm start
   ```
   Open http://localhost:3000 on your phone (same Wi-Fi: use your computer's IP, e.g. `http://192.168.x.x:3000`).

## How it works

- **POST /api/receipts** — accepts a receipt image, sends it to GPT-4o-mini vision, and inserts `{spent_at, merchant, amount, category}` into Supabase. Month view auto-jumps to the receipt's date.
- **GET /api/expenses?month=YYYY-MM** — month's expenses, grand total and per-category breakdown.
- **DELETE /api/expenses/:id** — remove an entry.

## Deploy to Render (share with your team)

1. Push this repo to GitHub (see "Publishing" below, or use Render's "New → Blueprint" directly from a local clone).
2. On [render.com](https://render.com): **New → Blueprint**, select the repo — `render.yaml` is picked up automatically.
3. When prompted, paste `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Deploy. Render gives you a URL like `https://receipt-snap.onrender.com` — share it with your team. Free tier spins down after 15 min idle; the first request after that takes ~30 s.
5. For a company domain, add it under the service's Settings → Custom Domains.

> The `.env` file is git-ignored — keys are only entered in Render's dashboard.

## Publishing to GitHub (from this folder)

```bash
git init
git add .
git commit -m "Receipt Snap: AI receipt expense tracker"
git branch -M main
git remote add origin https://github.com/<your-username>/receipt-snap.git
git push -u origin main
```

Then follow the Render steps above.

## Notes

- Categories: Groceries, Dining, Transport, Shopping, Bills, Health, Entertainment, Other.
- Keep the service-role key server-side only — the Supabase table has RLS enabled so the anon key can't touch it.
- No login is built in; it's designed as a personal app on a trusted network.
