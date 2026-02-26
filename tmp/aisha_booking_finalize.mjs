const base='http://localhost:3000';
const account='beauty-salon';
async function send(threadId,msg){
  const r=await fetch(`${base}/api/v1/public/ai/chat?account=${account}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:msg,threadId})});
  const j=await r.json(); return j.data;
}
async function run(name,turns){
  let t=0; console.log(`\n=== ${name} ===`);
  for(const m of turns){
    const o=await send(t,m); if(!t)t=o.threadId;
    const action=o.action?` action=${o.action.type}`:'';
    console.log('>',m);
    console.log('<',String(o.reply).replace(/\n/g,' ')+action);
    if(o.action?.bookingUrl) console.log('  bookingUrl=',o.action.bookingUrl);
  }
}
(async()=>{
  await run('flow_self', ['запиши меня на завтра на маникюр','в риверсайд','на 19:00','1','сам']);
  const phone = '+7999' + String(Math.floor(Math.random()*9000000+1000000));
  await run('flow_assistant', ['запиши меня на завтра на маникюр','в риверсайд','на 19:00','1','2',`имя Алена телефон ${phone}`,'Согласен на обработку персональных данных','да']);
})();
