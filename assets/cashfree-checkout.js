(() => {
  let active, timer, checking = false, generation = 0, initialCheck;
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
      const modalStatus=document.getElementById('modal-payment-status');
      if (result.verified) {
        clearInterval(timer);
        location.assign(`/success.html?order_id=${encodeURIComponent(active.orderId)}`);
      } else { if (status) status.textContent = result.message; if(modalStatus) modalStatus.textContent=result.message; }
    } catch(e) { const status = document.getElementById('payment-status');
      const modalStatus=document.getElementById('modal-payment-status'); if(status) status.textContent=e.message; if(modalStatus) modalStatus.textContent=e.message; }
    finally { checking=false; }
  }
  async function mount() {
    if (location.pathname !== '/payment') { clearInterval(timer); clearTimeout(initialCheck); active = null; return; }
    const page = document.querySelector('.pm-main');
    if (!page || page.dataset.upiReady) return;
    page.dataset.upiReady='true';
    const current = ++generation;
    const card = document.createElement('section'); card.className='database-payment';
    card.innerHTML=`<header class="dp-header"><button class="dp-back" aria-label="Back to address">‹</button><span>PAYMENT</span></header>
      <div class="dp-steps"><div class="complete"><i>✓</i>Cart</div><div class="complete"><i>✓</i>Address</div><div class="current"><i>3</i>Payment</div><div><i>4</i>Summary</div></div>
      <div class="dp-methods"><div class="dp-title"><h2>Select Payment Method</h2><span class="dp-safe">🛡 100% SAFE<br>PAYMENTS</span></div><div class="dp-offer"><span class="dp-paytm">paytm</span><strong>Pay online with UPI</strong></div><div class="dp-divider">PAY ONLINE</div><div class="dp-upi-heading"><span>▣</span> UPI(GPay/PhonePe/Paytm)<span class="dp-chevron">⌄</span></div><div id="payment-methods"></div></div>
      <div class="dp-prices" id="price-details"><div>Shipping:<strong>FREE</strong></div><div>Total Product Price:<strong data-payment-amount>—</strong></div><div class="dp-total">Order Total:<strong data-payment-amount>—</strong></div></div>
      <div class="dp-status"><p id="payment-status" role="status">Preparing your payment…</p><button id="retry-payment" hidden>Retry</button></div>
      <div class="dp-bottom"><div><strong data-payment-amount>—</strong><button class="dp-view">VIEW PRICE DETAILS</button></div><button class="dp-pay" disabled>PayNow</button></div>
      <dialog class="dp-dialog"><button class="dp-close" aria-label="Close">×</button><h3>Complete your payment</h3><div id="payment-details"></div></dialog>`;
    card.querySelector('.dp-back').onclick=()=>location.assign('/checkout');
    card.querySelector('.dp-view').onclick=()=>card.querySelector('#price-details').scrollIntoView({behavior:'smooth',block:'center'});
    card.querySelector('.dp-close').onclick=()=>card.querySelector('dialog').close();
    page.appendChild(card);
    card.querySelector('#retry-payment').onclick=()=>{ delete page.dataset.upiReady; card.remove(); mount(); };
    try {
      const cart=JSON.parse(localStorage.getItem('nexshop_cart') || '[]');
      const customer=JSON.parse(sessionStorage.getItem('address') || '{}');
      const order=await api('/api/create-order',{ items:cart.map(({id,qty})=>({id,qty})),customer });
      if(current!==generation || !card.isConnected || location.pathname!=='/payment') return;
      active=order;
      sessionStorage.setItem(`payment:${order.orderId}`,JSON.stringify({orderId:order.orderId,token:order.token}));
      const money=new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(order.amount);
      card.querySelectorAll('[data-payment-amount]').forEach(el=>el.textContent=money);
      const details=card.querySelector('#payment-details');
      const info=document.createElement('p'); info.textContent=`Amount: ${money} | Order ID: ${order.orderId}`; details.appendChild(info);
      const receiver=document.createElement('p'); receiver.textContent=`UPI: ${order.upi.id}`; details.appendChild(receiver);
      const note=document.createElement('p'); note.textContent='Keep this Order ID in the payment note/comment. Payment is confirmed after verification.'; details.appendChild(note);
      const links=window.referencePaymentLinks(order);
      const uri=links.qr;
      const img=document.createElement('img'); img.className='dp-qr'; img.alt='Scan to pay this order'; img.width=220; img.height=220; img.src=`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(uri)}`; details.appendChild(img);
      let selected='qr';
      const methods=card.querySelector('#payment-methods');
      for(const [flag,label,scheme,icon,iconClass] of [['Phonepe','PhonePe','phonepe://pay','पे','phonepe'],['Gpay','Google Pay','tez://upi/pay','G','gpay'],['Paytm','Paytm','paytmmp://pay','paytm','paytm'],['Bhim','BHIM / Any UPI','upi://pay','UPI','bhim'],['qr','Pay Using QR Code',null,'▦','qr']]) {
        if(flag!=='qr' && !order.upi[flag]) continue;
        const row=document.createElement('label'); row.className='dp-method';
        const radio=document.createElement('input'); radio.type='radio'; radio.name='payment-method'; radio.value=flag;
        if(!methods.children.length) { radio.checked=true; selected=flag; }
        radio.onchange=()=>selected=flag;
        const title=document.createElement('span'); title.textContent=label;
        const badge=document.createElement('span'); badge.className=`dp-icon dp-icon-${iconClass}`; badge.textContent=icon;
        row.append(radio,title,badge); methods.appendChild(row);

      }
      const payButton=card.querySelector('.dp-pay'); payButton.disabled=false;
      const openApp=document.createElement('a'); openApp.className='dp-open-app'; details.appendChild(openApp);
      const modalStatus=document.createElement('p'); modalStatus.id='modal-payment-status'; modalStatus.setAttribute('role','status'); details.appendChild(modalStatus);
      function startVerification() {
        clearInterval(timer); clearTimeout(initialCheck);
        modalStatus.textContent='Checking payment…';
        let attempts=0;
        initialCheck=setTimeout(verify,3000);
        timer=setInterval(()=>{ if(++attempts>120) { clearInterval(timer); modalStatus.textContent='Receipt is still pending. Check status again; do not pay twice.'; return; } verify(); },5000);
      }
      payButton.onclick=()=>{
        const qr=selected==='qr' || selected==='Bhim';
        img.hidden=!qr;
        openApp.hidden=qr;
        if(!qr) { openApp.href=links[selected]; openApp.textContent=`Open ${selected==='Phonepe'?'PhonePe':selected==='Gpay'?'Google Pay':'Paytm'}`; }
        card.querySelector('dialog').showModal();
        startVerification();
        if(!qr) location.assign(links[selected]);
      };
      const copy=document.createElement('button'); copy.textContent='Copy Order ID'; copy.onclick=async()=>{ try { await navigator.clipboard.writeText(order.orderId); copy.textContent='Copied'; } catch { copy.textContent='Copy the Order ID shown above'; } }; details.appendChild(copy);
      const check=document.createElement('button'); check.textContent='Check Payment Status'; check.onclick=startVerification; details.appendChild(check);
      card.querySelector('#payment-status').textContent='';

    } catch(e) { card.querySelector('#payment-status').textContent=e.message; card.querySelector('#retry-payment').hidden=false; }
  }
  const style=document.createElement('link'); style.rel='stylesheet'; style.href='/assets/payment-design.css?v=11'; document.head.appendChild(style);
  new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('focus',verify); mount();
})();
