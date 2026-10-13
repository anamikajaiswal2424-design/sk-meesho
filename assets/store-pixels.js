(() => {
  let configPromise;
  const config = () => configPromise ||= fetch('/api/settings').then(async r => { const data = await r.json(); if (!r.ok) throw Error(data.error); return data; }).catch(e => { configPromise = null; throw e; });
  window.storeSettings = config;
  function init(ids) {
    if (!ids.length) return;
    if (!window.fbq) {
      const n = window.fbq = function(){ n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = []; window._fbq = n;
      const script = document.createElement('script'); script.async = true; script.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(script);
    }
    ids.forEach(id => { window.fbq('init', id); window.fbq('set', 'autoConfig', false, id); });
  }
  const ready = config().then(c => { init(c.pixels); return c.pixels; });
  ready.catch(() => {});
  let lastPath;
  async function pageview() {
    if (location.pathname === '/success.html') return;
    const path = location.pathname + location.search;
    if (path === lastPath) return;
    lastPath = path;
    try { const ids = await ready; ids.forEach(id => window.fbq('trackSingle',id,'PageView')); } catch {}
  }
  ['pushState','replaceState'].forEach(method => {
    const original = history[method];
    history[method] = function(...args) { const result = original.apply(this,args); pageview(); return result; };
  });
  addEventListener('popstate',pageview); pageview();
  window.trackVerifiedPurchase = async order => {
    const ids = await ready;
    ids.forEach(id => {
      const key = `purchase:${id}:${order.orderId}`;
      if (localStorage.getItem(key)) return;
      window.fbq('trackSingle',id,'Purchase',{ value:order.amount, currency:'INR', order_id:order.orderId, content_ids:order.items.map(i=>String(i.id)), content_type:'product', num_items:order.items.reduce((n,i)=>n+i.qty,0) },{ eventID:order.eventId });
      localStorage.setItem(key,'1');
    });
  };
})();
