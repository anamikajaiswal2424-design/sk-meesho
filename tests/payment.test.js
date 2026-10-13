const test=require('node:test');const assert=require('node:assert/strict');
const {priceCart,credentials,hash,matchQuery,reserveOrder}=require('../lib/payment');
test('server prices cart and rejects invalid products/quantities',()=>{assert.equal(priceCart([{id:1,qty:2,price:1}]).amount,398);for(const items of [[{id:999999,qty:1}],[{id:1,qty:-1}],[{id:1,qty:7},{id:1,qty:7}],[]])assert.throws(()=>priceCart(items));});
test('order IDs and credentials are unique',()=>{const ids=new Set();for(let i=0;i<1000;i++){const c=credentials();assert.equal(hash(c.token),c.tokenHash);assert.match(c.orderId,/^[A-Z0-9]{5}$/);ids.add(c.orderId);}assert.ok(ids.size>980);});
const dbPath=require.resolve('../lib/db');
let fakeDb;
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:async()=>fakeDb};
const verify=require('../api/verify');
async function call(body){const response={code:200,setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};await verify({method:'POST',body},response);return response;}
function fixture(tx,options={}){
 const c=credentials();const order={_id:c.orderId,orderId:c.orderId,comment:c.orderId,tokenHash:c.tokenHash,amount:199,items:[{id:1,qty:1}]};let saved=null,claims=0;
 function matches(t,q){return q.status.$regex.test(t.status)&&q.$and[0].$or[0].comment.test(t.comment)&&Math.round(Number(t.amount)*100)===q.$expr.$eq[1]&&(!t.verifiedOrderId||t.verifiedOrderId===order.orderId);}
 const transactions=(tx||[]).map(t=>({_id:'source',status:'SUCCESS',comment:order.orderId,amount:199,...t}));
 fakeDb={main:{collection(name){return name==='paymentOrders'?{findOne:async q=>q.tokenHash===order.tokenHash?order:null,updateOne:async()=>{}}:{findOne:async()=>saved,updateOne:async()=>{if(options.saveFails)throw Error('save failed');saved={_id:order.orderId,status:'SUCCESS',amount:order.amount,items:order.items};}};}},ledger:{collection(){return{find(q){return{limit(){return{toArray:async()=>transactions.filter(t=>matches(t,q))};}};},findOneAndUpdate:async(q)=>{claims++;return transactions.find(t=>matches(t,q));}};}}};
 return {c,order,get claims(){return claims;}};
}
test('mismatched comment/amount/status and already claimed receipts cannot pass',async()=>{for(const tx of [{comment:'another-order'},{amount:198},{status:'PENDING'},{verifiedOrderId:'another-order'}]){const f=fixture([tx]);const r=await call({orderId:f.c.orderId,token:f.c.token,expectedAmount:198});assert.equal(r.data.verified,false);assert.equal(f.claims,0);}});
test('forged credentials rejected',async()=>{const f=fixture([{}]);const r=await call({orderId:f.c.orderId,token:'0'.repeat(64)});assert.equal(r.code,404);assert.equal(f.claims,0);});
test('ambiguous receipts rejected',async()=>{const f=fixture([{},{}]);const r=await call({orderId:f.c.orderId,token:f.c.token});assert.equal(r.data.verified,false);});
test('database save must finish before success; repeat verifies reuse saved transaction',async()=>{let f=fixture([{}],{saveFails:true});let r=await call({orderId:f.c.orderId,token:f.c.token});assert.equal(r.code,503);assert.notEqual(r.data.verified,true);f=fixture([{}]);r=await call({orderId:f.c.orderId,token:f.c.token,expectedAmount:1});assert.equal(r.data.verified,true);assert.equal(r.data.amount,199);await call({orderId:f.c.orderId,token:f.c.token});assert.equal(f.claims,1);});

test('short IDs are reserved atomically and retry collisions without recycling existing orders',async()=>{
const ids=new Set();let inserts=0;const orders={insertOne:async row=>{inserts++;if(inserts===1||ids.has(row._id)){const e=Error('duplicate');e.code=11000;throw e;}ids.add(row._id);}};const ledger={findOne:async()=>null};
for(let i=0;i<100;i++){const auth=await reserveOrder(orders,ledger,{status:'PENDING'});assert.equal(auth.orderId.length,5);}assert.equal(ids.size,100);assert.equal(inserts,101);
});

test('legacy QR receipt notes stripped of underscore match only their exact original ID',()=>{
const order={orderId:'MS_6d0d21cf8b5543859062529a21dc5a74',amount:1};const q=matchQuery(order);const note=q.$and[0].$or[0].comment;
assert.ok(note.test(order.orderId));assert.ok(note.test(order.orderId.replace('MS_','MS')));assert.equal(note.test('MS6d0d21cf8b5543859062529a21dc5a75'),false);assert.equal(q.$expr.$eq[1],100);assert.equal(q.status.$regex.test('PENDING'),false);
const short=matchQuery({orderId:'A7DX2',amount:1}).$and[0].$or[0].comment;assert.ok(short.test('A7DX2'));assert.equal(short.test('A7_DX2'),false);
});
