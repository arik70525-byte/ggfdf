const MAX_BODY = 60_000;
const allowed = new Set(['openai','anthropic','yandex']);
function json(res,status,body){res.status(status).setHeader('Content-Type','application/json; charset=utf-8').send(JSON.stringify(body));}
function outputText(data){if(typeof data.output_text==='string')return data.output_text;return (data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text'||x.type==='text').map(x=>x.text||'').join('\n');}
async function verifyUser(req){
  const auth=req.headers.authorization||'';if(!auth.startsWith('Bearer '))return null;
  const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_ANON_KEY;
  if(!url||!key)throw new Error('На сервере не настроены SUPABASE_URL и SUPABASE_ANON_KEY.');
  const r=await fetch(url.replace(/\/$/,'')+'/auth/v1/user',{headers:{apikey:key,Authorization:auth}});
  if(!r.ok)return null;return await r.json();
}
module.exports=async function handler(req,res){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{error:'Используй POST.'});}
  try{
    const user=await verifyUser(req);if(!user?.id)return json(res,401,{error:'Войди в CodeVault, чтобы пользоваться AI.'});
    const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});if(raw.length>MAX_BODY)return json(res,413,{error:'Слишком большой запрос.'});
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
    const provider=String(body.provider||'');const messages=Array.isArray(body.messages)?body.messages:[];
    if(!allowed.has(provider))return json(res,400,{error:'Неизвестный AI-провайдер.'});
    const clean=messages.slice(-12).map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'').slice(0,12000)})).filter(m=>m.content.trim());
    if(!clean.length)return json(res,400,{error:'Напиши сообщение.'});
    let reply='';
    if(provider==='openai'){
      if(!process.env.OPENAI_API_KEY)return json(res,503,{error:'OpenAI не подключён: добавь OPENAI_API_KEY в Vercel → Settings → Environment Variables.'});
      const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',input:clean})});
      const d=await r.json();if(!r.ok)return json(res,r.status,{error:d.error?.message||'Ошибка OpenAI API.'});reply=outputText(d);
    } else if(provider==='anthropic'){
      if(!process.env.ANTHROPIC_API_KEY)return json(res,503,{error:'Anthropic не подключён: добавь ANTHROPIC_API_KEY в Vercel.'});
      const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:process.env.ANTHROPIC_MODEL||'claude-sonnet-4-5',max_tokens:2048,messages:clean})});
      const d=await r.json();if(!r.ok)return json(res,r.status,{error:d.error?.message||'Ошибка Anthropic API.'});reply=(d.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');
    } else {
      if(!process.env.YANDEX_API_KEY||!process.env.YANDEX_FOLDER_ID)return json(res,503,{error:'YandexGPT не подключён: добавь YANDEX_API_KEY и YANDEX_FOLDER_ID в Vercel.'});
      const r=await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion',{method:'POST',headers:{Authorization:'Api-Key '+process.env.YANDEX_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({modelUri:`gpt://${process.env.YANDEX_FOLDER_ID}/${process.env.YANDEX_MODEL||'yandexgpt/latest'}`,completionOptions:{stream:false,temperature:0.6,maxTokens:2048},messages:clean.map(m=>({role:m.role==='assistant'?'assistant':'user',text:m.content}))})});
      const d=await r.json();if(!r.ok)return json(res,r.status,{error:d.message||'Ошибка YandexGPT API.'});reply=d.result?.alternatives?.[0]?.message?.text||'';
    }
    return json(res,200,{reply:reply||'Провайдер не вернул текстовый ответ.'});
  }catch(e){console.error('CodeVault AI error:',e);return json(res,500,{error:e.message||'Внутренняя ошибка AI API.'});}
};
