const base='http://localhost:3000';
const account='beauty-salon';
async function send(threadId,msg){const r=await fetch(`${base}/api/v1/public/ai/chat?account=${account}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:msg,threadId})}); return (await r.json()).data;}
(async()=>{let t=0; for(const m of ['на завтра есть окошки?','а на вечер?','у каких мастеров?']){const o=await send(t,m); if(!t)t=o.threadId; console.log('>',m); console.log('<',String(o.reply).replace(/\n/g,' '));}})();
