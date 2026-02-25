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

  const { key, videoId } = req.body;

  if (!key || !videoId) {
    return res.status(400).json({ error: 'Missing key or videoId' });
  }

  const { data, error } = await supabase
    .from('license_keys')
    .select('*')
    .eq('key', key.trim().toUpperCase())
    .single();

  if (error || !data || data.status !== 'active') {
    return res.status(403).json({ error: 'Invalid or inactive license key' });
  }

  if (data.ai_calls_used >= data.ai_calls_limit) {
    return res.status(403).json({ error: 'AI call limit reached' });
  }

  const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'You are a YouTube CTR expert. Analyze this thumbnail. Give: 1) CTR Score 0-100, 2) What works, 3) Top 3 improvements. Max 120 words.' },
            { type: 'image_url', image_url: { url: thumbUrl, detail: 'low' } }
          ]
        }],
        max_tokens: 200
      })
    });

    const aiData = await openaiRes.json();
    const result = aiData.choices?.[0]?.message?.content;
    if (!result) throw new Error('No AI response');

    await supabase
      .from('license_keys')
      .update({ ai_calls_used: data.ai_calls_used + 1 })
      .eq('key', key.trim().toUpperCase());

    return res.status(200).json({
      result,
      calls_remaining: data.ai_calls_limit - data.ai_calls_used - 1
    });

  } catch (e) {
    return res.status(500).json({ error: 'AI analysis failed. Try again.' });
  }
}
