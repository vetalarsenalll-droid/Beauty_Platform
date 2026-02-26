const base='http://localhost:3000';
async function send(msg,threadId){const r=await fetch(`${base}/api/v1/public/ai/chat?account=beauty-salon`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:msg,threadId})}); return (await r.json()).data;}
(async()=>{const o=await send('хочу на педикюр',0); console.log(o.reply.replace(/\n/g,' '));})();
