const base='http://localhost:3000'; const account='beauty-salon';
async function c(msg,tid){const r=await fetch(`${base}/api/v1/public/ai/chat?account=${account}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:msg,threadId:tid})});return (await r.json()).data;}
(async()=>{let t=0; for (const m of ['привет','как дела?','на сегодня есть свободные окошки?']){const o=await c(m,t); if(!t)t=o.threadId; console.log('>',m); console.log('<',o.reply.replace(/\n/g,' '));}})();
