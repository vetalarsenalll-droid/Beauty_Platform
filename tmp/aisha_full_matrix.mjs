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
  await run('chat_basics', ['привет','как дела?','кто ты?','что умеешь?']);
  await run('availability_to_specialists', ['на завтра есть окошки?','а на вечер?','у каких мастеров?']);
  await run('time_then_location_then_service', ['на завтра','в 17:00','в центр','женская стрижка']);
  await run('location_then_time_then_service', ['запиши меня на завтра','в риверсайд','на 19:00','маникюр']);
  await run('service_first_then_evening', ['хочу на педикюр','на вечер есть?','на 19:00']);
  await run('self_redirect', ['запиши на завтра на маникюр в риверсайд на 19:00','любой','сам']);
})();
