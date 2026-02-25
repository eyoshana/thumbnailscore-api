import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = () => Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `TS-${segment()}-${segment()}-${segment()}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') return res.status(405).end();

  const { email, product_name, sale_id } = req.body;

  if (!email) return res.status(400).json({ error: 'No email' });

  let key, exists = true;
  while (exists) {
    key = generateKey();
    const { data } = await supabase
      .from('license_keys')
      .select('key')
      .eq('key', key)
      .single();
    exists = !!data;
  }

  const { error } = await supabase
    .from('license_keys')
    .insert({ key, email, status: 'active', ai_calls_limit: 100 });

  if (error) return res.status(500).json({ error: 'Failed to create license' });

  return res.status(200).json({ success: true, key });
}
