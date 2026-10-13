const databases = require('../lib/db');
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'GET') return res.status(405).json({ error:'Method not allowed' });
  try {
    const { main } = await databases();
    const settings = await main.collection('settings').findOne({});
    if (!settings) return res.status(503).json({ error:'Settings unavailable' });
    const pixel = settings.facebookPixel || settings.facebookpixel || {};
    const ids = [...new Set((Array.isArray(pixel.id) ? pixel.id : String(pixel.id || '').split(/[\s,;]+/)).map(String).map(s=>s.trim()).filter(s=>/^\d{5,25}$/.test(s)))];
    const upi = settings.upi || {};
    return res.json({ upi:{ id:upi.id || '', name:upi.name || 'Store', Gpay:upi.Gpay===true, Phonepe:upi.Phonepe===true, Paytm:upi.Paytm===true, Bhim:upi.Bhim===true }, pixels:pixel.enabled===true ? ids : [] });
  } catch { return res.status(503).json({ error:'Settings temporarily unavailable' }); }
};
