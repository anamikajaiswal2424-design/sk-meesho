const products = require('../products.json');
const crypto = require('node:crypto');
function priceCart(items) {
  if (!Array.isArray(items) || !items.length || items.length > 100) throw new Error('Invalid cart');
  const quantities = new Map();
  for (const item of items) {
    const id = Number(item.id), qty = Number(item.qty);
    if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 10) throw new Error('Invalid quantity');
    const total = (quantities.get(id) || 0) + qty;
    if (total > 10) throw new Error('Maximum quantity is 10 per product');
    quantities.set(id, total);
  }
  const lines = [...quantities].map(([id, qty]) => {
    const p = products.find(p => p.id === id);
    if (!p || !(p.price > 0)) throw new Error('Product unavailable');
    return { id, qty, price: p.price, name: p.name };
  });
  return { items: lines, amount: lines.reduce((n,p) => n + Math.round(p.price*100)*p.qty,0)/100 };
}
function hash(token) { return crypto.createHash('sha256').update(String(token)).digest('hex'); }
function credentials() {
  const token = crypto.randomBytes(32).toString('hex');
  return { orderId: `MS_${crypto.randomUUID().replaceAll('-','')}`, token, tokenHash: hash(token) };
}
function matchQuery(order) {
  const exact = new RegExp(`^${order.orderId.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`,'i');
  return {
    status: { $regex: /^SUCCESS$/i },
    $and: [
      { $or: [{ comment: exact }, { $and: [{ $or: [{ comment: { $exists:false } },{ comment:null },{ comment:'' }] },{ remark:exact }] }] },
      { $or: [{ verifiedOrderId: { $exists:false } },{ verifiedOrderId:null },{ verifiedOrderId:exact }] }
    ],
    $expr: { $eq: [{ $round: [{ $multiply: [{ $convert: { input: { $ifNull: ['$amount',{ $ifNull: ['$totalAmount','$value'] }] }, to:'double', onError:-1, onNull:-1 } },100] },0] },Math.round(order.amount*100)] }
  };
}
module.exports = { priceCart, hash, credentials, matchQuery };
