import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CATEGORIES = [
  'Groceries', 'Dining', 'Transport', 'Shopping',
  'Bills', 'Health', 'Entertainment', 'Other',
];

async function extractReceipt(imageBase64, mimeType) {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const res = await openai.chat.completions.create({
    model,
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content:
          `You read receipts. Return ONLY JSON: ` +
          `{"merchant": string, "amount": number (grand total incl. tax/tip, as a positive number), "date": "YYYY-MM-DD" (date on receipt; today's date if absent: ${new Date().toISOString().slice(0, 10)}), "category": one of [${CATEGORIES.join(', ')}]}. ` +
          'If the total is unreadable, use null for that field.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract the total, merchant, date and category from this receipt.' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
  });
  return JSON.parse(res.choices[0].message.content);
}

app.use(express.json());

app.post('/api/expenses', async (req, res) => {
  try {
    const { merchant, amount, date, category } = req.body || {};
    const amt = Number(amount);
    if (!merchant || !Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: 'merchant and a positive amount are required.' });
    }
    const row = {
      spent_at: /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : new Date().toISOString().slice(0, 10),
      merchant: String(merchant).slice(0, 120),
      amount: amt,
      category: CATEGORIES.includes(category) ? category : 'Other',
    };
    const { error } = await supabase.from('expenses').insert(row);
    if (error) throw error;
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to save expense.' });
  }
});

app.post('/api/receipts', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No receipt image uploaded.' });

    const data = await extractReceipt(
      req.file.buffer.toString('base64'),
      req.file.mimetype
    );

    if (data.amount == null) {
      return res.status(422).json({ error: 'Could not read the amount from this receipt.' });
    }

    const row = {
      spent_at: data.date || new Date().toISOString().slice(0, 10),
      merchant: data.merchant || 'Unknown merchant',
      amount: data.amount,
      category: CATEGORIES.includes(data.category) ? data.category : 'Other',
    };

    const { error } = await supabase.from('expenses').insert(row);
    if (error) throw error;
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to process receipt.' });
  }
});

app.get('/api/expenses', async (req, res) => {
  try {
    const { month } = req.query; // "YYYY-MM"
    if (!/^\d{4}-\d{2}$/.test(month || '')) {
      return res.status(400).json({ error: 'month must be YYYY-MM' });
    }
    const start = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .gte('spent_at', start)
      .lt('spent_at', end)
      .order('spent_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    const total = data.reduce((s, e) => s + Number(e.amount), 0);
    const byCategory = {};
    for (const e of data) {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
    }
    res.json({ expenses: data, total, byCategory });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load expenses.' });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  const { error } = await supabase.from('expenses').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.use(express.static('public'));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Receipt Snap running at http://localhost:${port}`));
