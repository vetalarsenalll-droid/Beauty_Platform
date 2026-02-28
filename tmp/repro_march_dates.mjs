const base='http://localhost:3000';
const account='beauty-salon';
async function send(threadId,msg){
  const r=await fetch(`${base}/api/v1/public/ai/chat?account=${account}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:msg,threadId})});
  const j=await r.json();
  return j.data;
}
(async()=>{
  let t=0;
  const turns=[
    'запиши меня сегодня',
    'привет, какие числа в марте свободны для записи?',
    '2026-03-04'
  ];
  for(const m of turns){
    const o=await send(t,m); if(!t)t=o.threadId;
    console.log('\n>',m);
    console.log('<',o.reply.replace(/\n/g,' | '));
    console.log('ui',o.ui ? `${o.ui.kind}:${(o.ui.options||[]).length}` : 'null');
    if(o.ui?.options?.length) console.log('first',o.ui.options[0]);
  }
})();
