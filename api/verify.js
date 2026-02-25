import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { key } = req.body;

  if (!key || typeof key !== 'string') {
    return res.status(400).json({ valid: false, error: 'No key provided' });
  }

  const { data, error } = await supabase
    .from('license_keys')
    .select('*')
    .eq('key', key.trim().toUpperCase())
    .single();

  if (error || !data) {
    return res.status(200).json({ valid: false, error: 'Invalid license key' });
  }

  if (data.status !== 'active') {
    return res.status(200).json({ valid: false, error: 'License key is inactive' });
  }

  if (data.ai_calls_used >= data.ai_calls_limit) {
    return res.status(200).json({ valid: false, error: 'AI call limit reached' });
  }

  if (!data.activated_at) {
    await supabase
      .from('license_keys')
      .update({ activated_at: new Date().toISOString() })
      .eq('key', key.trim().toUpperCase());
  }

  return res.status(200).json({
    valid: true,
    email: data.email,
    calls_used: data.ai_calls_used,
    calls_limit: data.ai_calls_limit,
    calls_remaining: data.ai_calls_limit - data.ai_calls_used
  });
}
