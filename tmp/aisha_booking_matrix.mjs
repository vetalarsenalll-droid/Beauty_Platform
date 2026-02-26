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
    console.log('>',m);
    console.log('<',String(o.reply).replace(/\n/g,' '));
  }
}
(async()=>{
  await run('booking_path_1', ['привет, запиши меня на завтра','10.30','один','а маникюра нет?','давай гель лак']);
  await run('booking_path_2', ['на сегодня есть свободные окна?','в центр на 10:30','женская стрижка']);
  await run('booking_path_3', ['запиши меня на завтра на маникюр','в риверсайд','на 19:00']);
  await run('booking_path_4', ['на вечер есть окна?','на 20:15','в центр','balayage']);
})();
