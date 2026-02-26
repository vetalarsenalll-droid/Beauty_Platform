const base = 'http://localhost:3000';
const account = 'beauty-salon';

function parseSetCookie(h){
  const raw = h['set-cookie'];
  if(!raw) return '';
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((x)=>x.split(';')[0]).join('; ');
}

async function req(path, opts={}){
  const res = await fetch(base + path, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return {res, json, text};
}

(async () => {
  const email = `autotest_${Date.now()}@example.com`;
  const pass = 'Passw0rd!123';
  const reg = await req('/api/v1/auth/client/register', {
    method:'POST',
    headers:{'content-type':'application/json'},
    body: JSON.stringify({email,password:pass,accountSlug:account,firstName:'Auto',lastName:'Node'})
  });
  const cookie = parseSetCookie(Object.fromEntries(reg.res.headers.entries()));

  let threadId = 0;
  async function chat(msg){
    const out = await req(`/api/v1/public/ai/chat?account=${account}`, {
      method:'POST',
      headers:{'content-type':'application/json', cookie},
      body: JSON.stringify({message:msg, threadId})
    });
    const data = out.json?.data;
    if(!threadId) threadId = data.threadId;
    console.log('>', msg);
    console.log('<', data.reply);
  }

  await chat('привет');
  await chat('какая у меня ближайшая запись?');
  await chat('какая у меня последняя запись?');
  await chat('отмени ее');
})();
