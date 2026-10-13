(() => {
  let active, timer, checking = false, generation = 0;
  async function api(path, body) {
    const r = await fetch(path,{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body) });
    const data = await r.json(); if (!r.ok) throw Error(data.error || 'Please retry.'); return data;
  }
  async function verify() {
    if (!active || checking || location.pathname !== '/payment') return;
    checking = true;
    try {
      const result = await api('/api/verify',{ orderId:active.orderId,token:active.token });
      const status = document.getElementById('payment-status');
      if (result.verified) {
        clearInterval(timer);
        location.assign(`/success.html?order_id=${encodeURIComponent(active.orderId)}`);
      } else if (status) status.textContent = result.message;
    } catch(e) { const status = document.getElementById('payment-status'); if(status) status.textContent=e.message; }
    finally { checking=false; }
  }
  async function mount() {
    if (location.pathname !== '/payment') { clearInterval(timer); active = null; return; }
    const page = document.querySelector('.pm-main');
    if (!page || page.dataset.upiReady) return;
    page.dataset.upiReady='true';
    const current = ++generation;
    const card = document.createElement('section'); card.className='database-payment';
    card.innerHTML='<h2>UPI Payment</h2><p id="payment-status">Preparing your payment…</p><div id="payment-details"></div><button id="retry-payment" hidden>Retry</button>';
    page.appendChild(card);
    card.querySelector('#retry-payment').onclick=()=>{ delete page.dataset.upiReady; card.remove(); mount(); };
    try {
      const cart=JSON.parse(localStorage.getItem('nexshop_cart') || '[]');
      const customer=JSON.parse(sessionStorage.getItem('address') || '{}');
      const order=await api('/api/create-order',{ items:cart.map(({id,qty})=>({id,qty})),customer });
      if(current!==generation || !card.isConnected || location.pathname!=='/payment') return;
      active=order;
      sessionStorage.setItem(`payment:${order.orderId}`,JSON.stringify({orderId:order.orderId,token:order.token}));
      const details=card.querySelector('#payment-details');
      const info=document.createElement('p'); info.textContent=`Amount: ₹${order.amount.toFixed(2)} | Order ID: ${order.orderId}`; details.appendChild(info);
      const receiver=document.createElement('p'); receiver.textContent=`UPI: ${order.upi.id}`; details.appendChild(receiver);
      const note=document.createElement('p'); note.textContent='Payment note/comment must contain the exact Order ID. Success opens after payment verification.'; details.appendChild(note);
      const params=new URLSearchParams({pa:order.upi.id,pn:order.upi.name,am:order.amount.toFixed(2),cu:'INR',tr:order.orderId,tn:order.orderId});
      const uri=`upi://pay?${params}`;
      const img=document.createElement('img'); img.alt='Scan to pay this order'; img.width=220; img.height=220; img.src=`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(uri)}`; details.appendChild(img);
      for(const [flag,label,scheme] of [['Phonepe','PhonePe','phonepe://pay'],['Gpay','Google Pay','tez://upi/pay'],['Paytm','Paytm','paytmmp://pay'],['Bhim','BHIM / Any UPI','upi://pay']]) {
        if(!order.upi[flag]) continue;
        const a=document.createElement('a'); a.textContent=`Pay with ${label}`; a.href=`${scheme}?${params}`; details.appendChild(a);
      }
      const copy=document.createElement('button'); copy.textContent='Copy Order ID'; copy.onclick=async()=>{ try { await navigator.clipboard.writeText(order.orderId); copy.textContent='Copied'; } catch { copy.textContent='Copy the Order ID shown above'; } }; details.appendChild(copy);
      const check=document.createElement('button'); check.textContent='Check Payment Status'; check.onclick=verify; details.appendChild(check);
      card.querySelector('#payment-status').textContent='Waiting for payment';
      clearInterval(timer); let attempts=0;
      timer=setInterval(()=>{ if(++attempts>120) { clearInterval(timer); return; } verify(); },5000);
    } catch(e) { card.querySelector('#payment-status').textContent=e.message; card.querySelector('#retry-payment').hidden=false; }
  }
  const style=document.createElement('style'); style.textContent='.pm-main>*:not(.database-payment){display:none!important}.database-payment{padding:28px 18px;text-align:center;background:white;min-height:60vh;font:14px Arial,sans-serif}.database-payment p{overflow-wrap:anywhere;line-height:1.6}.database-payment a,.database-payment button{display:block;padding:14px;margin:12px auto;max-width:380px;background:#9f2089;border:0;border-radius:8px;color:white;text-decoration:none;cursor:pointer}.database-payment img{display:block;margin:18px auto}'; document.head.appendChild(style);
  new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('focus',verify); mount();
})();
