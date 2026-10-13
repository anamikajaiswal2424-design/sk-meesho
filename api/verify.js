const databases = require('../lib/db');
const { hash, matchQuery } = require('../lib/payment');
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
  const { orderId, token } = req.body || {};
  if (!/^MS_[a-f0-9]{32}$/.test(orderId || '') || !/^[a-f0-9]{64}$/.test(token || '')) return res.status(400).json({ error:'Invalid order' });
  try {
    const { main, ledger } = await databases();
    const orders = main.collection('paymentOrders');
    const order = await orders.findOne({ _id:orderId, tokenHash:hash(token) });
    if (!order) return res.status(404).json({ error:'Order not found' });
    let saved = await main.collection('transactions').findOne({ _id:orderId, status:'SUCCESS' });
    if (!saved) {
      const query = matchQuery(order);
      const candidates = await ledger.collection('transactions').find(query).limit(2).toArray();
      if (candidates.length !== 1) return res.json({ verified:false, message:candidates.length ? 'Multiple matching payments; contact support.' : 'Payment not found yet. Keep the order ID in the payment note.' });
      const match = await ledger.collection('transactions').findOneAndUpdate({ ...query, _id:candidates[0]._id },{ $set:{ verifiedOrderId:orderId, verifiedAt:new Date() } },{ returnDocument:'after', includeResultMetadata:false });
      if (!match) return res.json({ verified:false, message:'Payment is being checked. Retry.' });
      await main.collection('transactions').updateOne({ _id:orderId },{ $setOnInsert:{ orderId, comment:order.comment, amount:order.amount, currency:'INR', status:'SUCCESS', sourceTransactionId:match._id, items:order.items, createdAt:new Date() } },{ upsert:true });
      saved = await main.collection('transactions').findOne({ _id:orderId, status:'SUCCESS' });
    }
    await orders.updateOne({ _id:orderId },{ $set:{ status:'SUCCESS', transactionId:saved._id } });
    return res.json({ verified:true, orderId, amount:saved.amount, currency:'INR', items:saved.items, eventId:`purchase_${orderId}` });
  } catch { return res.status(503).json({ error:'Verification temporarily unavailable. Please retry.' }); }
};
