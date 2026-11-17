const $ = id => document.getElementById(id);
const cfg = window.CODEVAULT_CONFIG || {};
const ADMIN = String(cfg.ADMIN_EMAIL || 'arik70525@gmail.com').toLowerCase();
let supabaseClient = null, currentUser = null, catalog = [], registering = false;
const ready = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !String(cfg.SUPABASE_URL).includes('ВСТАВЬ_') && window.supabase;
if (ready) supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function setStatus(id,msg){$(id).textContent=msg;}
function isAdmin(){return !!currentUser && String(currentUser.email||'').toLowerCase()===ADMIN;}
function render(){const q=$('search').value.toLowerCase();const shown=catalog.filter(p=>(p.name+' '+(p.description||'')).toLowerCase().includes(q));$('projectCount').textContent=catalog.length;$('projectGrid').innerHTML=shown.length?shown.map((p,i)=>`<article class="project-card"><div class="project-top"><span>PROJECT / ${String(i+1).padStart(3,'0')}</span><span>HTML</span></div><div class="file-icon">⌘</div><h3>${esc(p.name)}</h3><p>${esc(p.description||'Авторский веб-проект.')}</p><div class="project-actions"><a href="${esc(p.public_url)}" target="_blank" rel="noopener">Открыть демо ↗</a><a href="${esc(p.public_url)}" download>HTML ↓</a></div></article>`).join(''):`<div class="empty"><div class="empty-icon">◇</div><h3>${catalog.length?'Ничего не найдено':'Пока здесь тихо'}</h3><p>${catalog.length?'Попробуй изменить поисковый запрос.':'Проекты появятся после первой публикации через админ-панель.'}</p></div>`;}
async function loadProjects(){if(!supabaseClient){$('projectGrid').innerHTML='<div class="empty"><h3>Нужно подключить базу данных</h3><p>Добавь настройки Supabase в config.js. Инструкция находится в README.</p></div>';return;}const {data,error}=await supabaseClient.from('projects').select('id,name,description,public_url,created_at').order('created_at',{ascending:false});if(error){console.error(error);$('projectGrid').innerHTML='<div class="empty"><h3>Не удалось загрузить проекты</h3><p>Проверь настройки Supabase и SQL-политики.</p></div>';return;}catalog=data||[];render();}
function updateAccountUI(){const email=currentUser?.email||'';$('userLabel').textContent=email;$('authOpen').classList.toggle('hidden',!!currentUser);$('logout').classList.toggle('hidden',!currentUser);$('adminOpen').classList.toggle('hidden',!isAdmin());}
async function refreshSession(){if(!supabaseClient){updateAccountUI();return;}const {data}=await supabaseClient.auth.getSession();currentUser=data.session?.user||null;updateAccountUI();}
$('year').textContent=new Date().getFullYear();$('search').addEventListener('input',render);
$('authOpen').onclick=()=>{$('authModal').classList.remove('hidden');setStatus('authStatus','');};$('closeAuth').onclick=()=>$('authModal').classList.add('hidden');$('closeAdmin').onclick=()=>$('adminModal').classList.add('hidden');
$('authToggle').onclick=()=>{registering=!registering;$('authTitle').innerHTML=registering?'Регистрация <span>аккаунта</span>':'Вход <span>в аккаунт</span>';$('authSubmit').textContent=registering?'Зарегистрироваться':'Войти';$('authToggle').textContent=registering?'Уже есть аккаунт? Войти':'Нет аккаунта? Зарегистрироваться';$('authPassword').autocomplete=registering?'new-password':'current-password';setStatus('authStatus','');};
$('authSubmit').onclick=async()=>{if(!supabaseClient){setStatus('authStatus','Сначала настрой Supabase в config.js.');return;}const email=$('authEmail').value.trim().toLowerCase(),password=$('authPassword').value;if(!email||password.length<6){setStatus('authStatus','Введи email и пароль минимум из 6 символов.');return;}$('authSubmit').disabled=true;try{if(registering){const {data,error}=await supabaseClient.auth.signUp({email,password});if(error)throw error;setStatus('authStatus',data.session?'Аккаунт создан!':'Проверь почту и подтверди регистрацию.');}else{const {error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)throw error;$('authModal').classList.add('hidden');}}catch(e){setStatus('authStatus','Ошибка: '+e.message);}finally{$('authSubmit').disabled=false;}};
$('logout').onclick=async()=>{await supabaseClient?.auth.signOut();currentUser=null;updateAccountUI();setStatus('adminStatus','');};
$('adminOpen').onclick=()=>{if(!isAdmin()){alert('Доступ разрешён только администратору.');return;}$('adminModal').classList.remove('hidden');setStatus('adminStatus','');};
$('publish').onclick=async()=>{if(!isAdmin()){setStatus('adminStatus','Нет прав администратора.');return;}const name=$('projectName').value.trim(),description=$('projectDesc').value.trim(),file=$('projectFile').files[0],code=$('projectCode').value.trim();if(!name){setStatus('adminStatus','Укажи название проекта.');return;}if(!file&&!code){setStatus('adminStatus','Вставь HTML-код или выбери HTML-файл.');return;}if(file&&!/\.html?$/i.test(file.name)){setStatus('adminStatus','Поддерживаются только .html и .htm.');return;}const html=file?await file.text():code;if(!/<html[\s>]/i.test(html)&&!/^<!doctype html/i.test(html)){setStatus('adminStatus','Похоже, это не полный HTML-документ. Добавь разметку HTML.');return;}if(new Blob([html]).size>2*1024*1024){setStatus('adminStatus','Размер HTML не должен превышать 2 МБ.');return;}$('publish').disabled=true;setStatus('adminStatus','Публикуем проект…');try{const slug=name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9а-яё]+/gi,'-').replace(/^-|-$/g,'').slice(0,48)||'project';const path=`${Date.now()}-${slug}.html`;const {error:uploadError}=await supabaseClient.storage.from('projects').upload(path,new Blob([html],{type:'text/html;charset=utf-8'}),{contentType:'text/html; charset=utf-8',upsert:false});if(uploadError)throw uploadError;const {data:urlData}=supabaseClient.storage.from('projects').getPublicUrl(path);const {error:insertError}=await supabaseClient.from('projects').insert({name,description,storage_path:path,public_url:urlData.publicUrl,created_by:currentUser.id});if(insertError){await supabaseClient.storage.from('projects').remove([path]);throw insertError;}$('projectName').value='';$('projectDesc').value='';$('projectCode').value='';$('projectFile').value='';setStatus('adminStatus','Готово! Проект опубликован.');await loadProjects();}catch(e){console.error(e);setStatus('adminStatus','Ошибка публикации: '+e.message);}finally{$('publish').disabled=false;}};
if(supabaseClient){supabaseClient.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user||null;updateAccountUI();});}
(async()=>{await refreshSession();await loadProjects();})();


// --- CodeVault Studio: live HTML preview, Capacitor project export, multi-provider AI ---
const compilerCode = $('compilerCode');
const previewFrame = $('htmlPreview');
function refreshPreview(){ if(!compilerCode || !previewFrame) return; previewFrame.srcdoc = compilerCode.value; $('codeSize').textContent = `${compilerCode.value.length.toLocaleString('ru-RU')} символов`; }
if(compilerCode){ compilerCode.addEventListener('input',()=>{ $('codeSize').textContent = `${compilerCode.value.length.toLocaleString('ru-RU')} символов`; }); refreshPreview(); }
$('runPreview')?.addEventListener('click',refreshPreview);
$('clearCode')?.addEventListener('click',()=>{compilerCode.value='';refreshPreview();});
$('downloadHtml')?.addEventListener('click',()=>downloadBlob(new Blob([compilerCode.value],{type:'text/html;charset=utf-8'}),'index.html'));
function downloadBlob(blob,name){const a=document.createElement('a');const u=URL.createObjectURL(blob);a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);}
$('buildApk')?.addEventListener('click',async()=>{
  const status=$('buildStatus');
  if(!window.JSZip){status.textContent='Не удалось загрузить ZIP-библиотеку. Проверь интернет и обнови страницу.';return;}
  const html=compilerCode.value.trim(); if(!html){status.textContent='Сначала добавь HTML-код.';return;}
  const btn=$('buildApk');btn.disabled=true;status.textContent='Готовим Android-проект…';
  try{
    const zip=new JSZip();
    zip.file('package.json',JSON.stringify({name:'codevault-android-app',version:'1.0.0',private:true,scripts:{'android:sync':'npx cap sync android','android:open':'npx cap open android'},dependencies:{'@capacitor/core':'^8.0.0'},devDependencies:{'@capacitor/cli':'^8.0.0','@capacitor/android':'^8.0.0'}},null,2));
    zip.file('capacitor.config.json',JSON.stringify({appId:'com.codevault.generated',appName:'CodeVault Project',webDir:'www',bundledWebRuntime:false},null,2));
    zip.file('www/index.html',html);
    zip.file('.gitignore','node_modules/\nandroid/.gradle/\nandroid/build/\nandroid/app/build/\n');
    zip.file('.github/workflows/build-apk.yml',`name: Build Android APK\non:\n  workflow_dispatch:\n  push:\n    branches: [ main, master ]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n      - uses: actions/setup-java@v4\n        with:\n          distribution: temurin\n          java-version: 21\n      - uses: android-actions/setup-android@v3\n      - run: npm install\n      - run: npx cap add android\n      - run: npx cap sync android\n      - name: Build debug APK\n        run: cd android && chmod +x gradlew && ./gradlew assembleDebug\n      - uses: actions/upload-artifact@v4\n        with:\n          name: codevault-debug-apk\n          path: android/app/build/outputs/apk/debug/app-debug.apk\n          if-no-files-found: error\n`);
    zip.file('README-RU.md',`# Android APK из CodeVault\n\nВ архив включён твой HTML-файл и проект на Capacitor. Это исходный Android-проект, а не готовый APK.\n\n## Быстрая сборка через GitHub Actions\n1. Создай новый пустой репозиторий GitHub.\n2. Загрузи сюда все файлы из этого архива.\n3. Открой вкладку Actions и разреши запуск workflow, если GitHub попросит.\n4. Запусти **Build Android APK** через Run workflow или сделай push в main.\n5. После завершения открой запуск workflow и скачай artifact **codevault-debug-apk**. Внутри будет app-debug.apk.\n\n## Локальная сборка\nНужны Node.js 22+, Android Studio и Android SDK. В корне проекта выполни:\n\n\`\`\`bash\nnpm install\nnpx cap add android\nnpx cap sync android\nnpx cap open android\n\`\`\`\n\nВ Android Studio выбери Build → Build APK(s).\n\nДля публикации в Google Play потребуется release-сборка и собственная подпись приложения. Не используй debug APK как релиз.\n`);
    const blob=await zip.generateAsync({type:'blob'});downloadBlob(blob,'CodeVault-Android-Project.zip');status.textContent='Готово! Скачан Android-проект. Загрузи его в GitHub и запусти Build Android APK во вкладке Actions.';
  }catch(e){console.error(e);status.textContent='Ошибка подготовки: '+e.message;}finally{btn.disabled=false;}
});

const providerHelp={openai:'OpenAI Responses API · ключ хранится в Vercel.',anthropic:'Anthropic Messages API · ключ хранится в Vercel.',yandex:'Yandex Cloud AI Studio · API-ключ и Folder ID хранятся в Vercel.'};
$('aiProvider')?.addEventListener('change',()=>{$('providerInfo').textContent=providerHelp[$('aiProvider').value]||'';});
let chatHistory=[];
function addChatMessage(role,text){const wrap=$('chatMessages');const welcome=wrap.querySelector('.welcome-message');if(welcome)welcome.remove();const el=document.createElement('div');el.className='chat-message '+role;const label=document.createElement('span');label.className='role';label.textContent=role==='user'?'YOU':'CODEVAULT AI';el.appendChild(label);el.appendChild(document.createTextNode(text));wrap.appendChild(el);wrap.scrollTop=wrap.scrollHeight;return el;}
async function sendChat(text){
  const msg=text.trim();if(!msg)return;
  if(!supabaseClient){addChatMessage('assistant','Сначала настрой Supabase в config.js и опубликуй сайт.');return;}
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session?.access_token){addChatMessage('assistant','Чтобы пользоваться AI Studio, сначала войди в аккаунт.');$('authModal').classList.remove('hidden');return;}
  addChatMessage('user',msg);chatHistory.push({role:'user',content:msg});
  const pending=addChatMessage('assistant','Думаю…');$('chatStatus').textContent='Запрос отправлен';
  const provider=$('aiProvider').value;
  try{
    const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify({provider,messages:chatHistory.slice(-12)})});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`Ошибка API (${response.status})`);
    pending.lastChild.textContent=data.reply||'Провайдер вернул пустой ответ.';chatHistory.push({role:'assistant',content:data.reply||''});
  }catch(e){pending.lastChild.textContent='Не удалось получить ответ: '+e.message;chatHistory.pop();}
  finally{$('chatStatus').textContent='';$('chatMessages').scrollTop=$('chatMessages').scrollHeight;}
}
$('chatForm')?.addEventListener('submit',e=>{e.preventDefault();const input=$('chatInput');const v=input.value;input.value='';sendChat(v);});
$('chatInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('chatForm').requestSubmit();}});
document.querySelectorAll('.prompt-chip').forEach(b=>b.addEventListener('click',()=>{$('chatInput').value=b.dataset.prompt||'';$('chatInput').focus();}));
$('clearChat')?.addEventListener('click',()=>{chatHistory=[];$('chatMessages').innerHTML='<div class="welcome-message"><div class="welcome-orb">✳</div><h3>Новый диалог</h3><p>Напиши, что хочешь создать или исправить.</p></div>';});
// Smooth active navigation state
const navLinks=[...document.querySelectorAll('.nav-link')];const sections=['home','projects','compiler','ai'].map(id=>document.getElementById(id));
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){navLinks.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+e.target.id));}}),{rootMargin:'-25% 0px -60% 0px'});sections.forEach(s=>s&&observer.observe(s));}
