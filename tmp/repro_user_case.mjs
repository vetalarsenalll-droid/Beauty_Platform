const base='http://localhost:3000';
const account='beauty-salon';
async function send(threadId,msg){
  const r=await fetch(`${base}/api/v1/public/ai/chat?account=${account}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:msg,threadId})});
  const j=await r.json(); return j.data;
}
(async()=>{
 let t=0;
 const turns=['привет, запиши меня на завтра','10.30','один','а маникюра нет?','давай гель лак'];
 for(const m of turns){const o=await send(t,m); if(!t)t=o.threadId; console.log('>',m); console.log('<',String(o.reply).replace(/\n/g,' '));}
})();
