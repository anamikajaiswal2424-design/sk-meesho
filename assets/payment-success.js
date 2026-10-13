(async () => {
  const heading=document.querySelector('h1'), message=document.getElementById('message');
  const orderId=new URLSearchParams(location.search).get('order_id');
  try {
    const credentials=JSON.parse(sessionStorage.getItem(`payment:${orderId}`) || 'null');
    if(!credentials) throw Error('Order credentials missing. Return to the payment page.');
    const r=await fetch('/api/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(credentials)});
    const order=await r.json(); if(!r.ok || !order.verified) throw Error(order.error || order.message || 'Payment has not been verified.');
    heading.textContent='Payment Done'; message.textContent=`Order ID: ${order.orderId} | Amount: ₹${order.amount.toFixed(2)} | SUCCESS`;
    document.getElementById('mark').textContent='✓';
    localStorage.removeItem('nexshop_cart');
    try { await window.trackVerifiedPurchase(order); } catch { /* Pixel availability never changes payment status. */ }
  } catch(e) { heading.textContent='Payment verification required'; message.textContent=e.message; }
})();
