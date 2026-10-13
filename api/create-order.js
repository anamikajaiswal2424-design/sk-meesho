const databases = require('../lib/db');
const { priceCart, credentials } = require('../lib/payment');
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
  let cart;
  try { cart = priceCart(req.body?.items); } catch(e) { return res.status(400).json({ error:e.message }); }
  try {
    const { main } = await databases();
    const settings = await main.collection('settings').findOne({});
    const upi = settings?.upi;
    if (!upi || !/^[\w.\-]+@[\w.\-]+$/.test(upi.id || '')) return res.status(503).json({ error:'UPI is not configured' });
    const { orderId, token, tokenHash } = credentials();
    await main.collection('paymentOrders').insertOne({ _id:orderId, orderId, comment:orderId, tokenHash, ...cart, upiId:upi.id, customer:{ name:String(req.body?.customer?.name || '').slice(0,100), mobile:String(req.body?.customer?.mobile || '').slice(0,20) }, status:'PENDING', createdAt:new Date() });
    return res.json({ orderId, token, amount:cart.amount, comment:orderId, upi:{ id:upi.id, name:upi.name || 'Store', Gpay:upi.Gpay===true, Phonepe:upi.Phonepe===true, Paytm:upi.Paytm===true, Bhim:upi.Bhim===true } });
  } catch { return res.status(503).json({ error:'Unable to create payment order. Please retry.' }); }
};
