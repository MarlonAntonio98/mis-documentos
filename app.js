'use strict';
(() => {
if (window.top !== window.self) { document.documentElement.classList.add('framed'); return; }

const $ = s => document.querySelector(s);
const main = $('#main'), ov = $('#overlay');
const PIN_LEN = 6, ITER = 600000, LOCK_HIDDEN_MS = 30000, LOCK_PICKING_MS = 300000, LOCK_IDLE_MS = 180000;
const CATS = {identidad:'Identidad',vehiculo:'Vehículo',salud:'Salud',estudios:'Estudios',finanzas:'Finanzas',trabajo:'Trabajo',otros:'Otros'};
const SUG = {'DUI':['identidad',60],'Pasaporte':['identidad',120],'Partida de nacimiento':['identidad',30],'Licencia de conducir':['vehiculo',60],'Tarjeta de circulación':['vehiculo',30],'Carné del ISSS':['salud',30],'Carné de vacunación':['salud',30],'Título universitario':['estudios',30],'Póliza de seguro':['finanzas',30],'Contrato de trabajo':['trabajo',30]};
const WARNS = [15,30,60,90,120,180];
const I = {plus:'<path d="M12 5v14M5 12h14"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',back:'<path d="m15 6-6 6 6 6"/>',eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',eyeoff:'<path d="M3 3l18 18"/><path d="M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.8M6.6 7.6C3.8 9.4 2 12 2 12s3.5 6 10 6a10 10 0 0 0 4.4-1"/>',finger:'<path d="M12 11v3a8 8 0 0 1-1.5 4.5"/><path d="M8 8.5a4.5 4.5 0 0 1 8.5 2V13a12 12 0 0 1-.8 4.3"/><path d="M5 12a7 7 0 0 1 12-5"/><path d="M8.5 13v1a5 5 0 0 1-1.3 3.3"/><path d="M19.5 10.5V13a15 15 0 0 1-.4 3"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',share:'<path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6"/>',lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',chev:'<path d="m9 6 6 6-6 6"/>',down:'<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',up:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>'};
const ic = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const uid = () => Date.now().toString(36) + Array.from(crypto.getRandomValues(new Uint8Array(6)), b => (b % 36).toString(36)).join('');
const LS = {get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,String(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const NO_SPELL = 'autocomplete="off" autocorrect="off" spellcheck="false"';

/* ---------- Fechas y estados ---------- */
const today0 = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const parseD = s => { if (!s) return null; const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const fmtD = s => { const d = parseD(s); return d ? d.toLocaleDateString('es-SV',{day:'numeric',month:'short',year:'numeric'}).replace(/\./g,'') : ''; };
const daysLeft = d => { const e = parseD(d.exp); return e ? Math.round((e - today0()) / 864e5) : null; };
function status(d){ const n = daysLeft(d);
  if (n === null) return {k:'none',t:'Sin vencimiento',r:3,n:Infinity};
  if (n < 0) return {k:'bad',t:n===-1?'Venció ayer':(-n<=60?`Venció hace ${-n} días`:'Vencido'),r:0,n};
  if (n <= d.warn) return {k:'warn',t:n===0?'Vence hoy':n===1?'Vence mañana':`Vence en ${n} días`,r:1,n};
  return {k:'ok',t:'Vigente',r:2,n}; }
const isAtt = d => ['bad','warn'].includes(status(d).k);
const sorted = l => [...l].sort((a,b) => { const A = status(a), B = status(b); return A.r-B.r || A.n-B.n || a.name.localeCompare(b.name,'es'); });
const mask = n => { if (!n) return ''; const s = n.replace(/[^A-Za-z0-9]/g,''); return s.length <= 4 ? '••••' : '•••• ' + s.slice(-4); };

/* ---------- Almacenamiento (IndexedDB, solo datos cifrados) ---------- */
const DB = { db:null,
  open(){ return new Promise(res => { try { const r = indexedDB.open('mis-documentos-seguro', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('docs',{keyPath:'id'}); d.createObjectStore('meta',{keyPath:'k'}); };
    r.onsuccess = () => { this.db = r.result; res(true); }; r.onerror = () => res(false); r.onblocked = () => res(false);
  } catch(e){ res(false); } }); },
  req(s, m, fn){ return new Promise((res, rej) => { try { const t = this.db.transaction(s, m), q = fn(t.objectStore(s)); let out;
    if (q) q.onsuccess = () => { out = q.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  } catch(e){ rej(e); } }); },
  get(s,k){ return this.req(s,'readonly',o=>o.get(k)); },
  all(s){ return this.req(s,'readonly',o=>o.getAll()).then(r=>r||[]); },
  put(s,v){ return this.req(s,'readwrite',o=>o.put(v)); },
  del(s,k){ return this.req(s,'readwrite',o=>o.delete(k)); },
  clear(s){ return this.req(s,'readwrite',o=>o.clear()); } };

/* ---------- Criptografía ---------- */
const te = new TextEncoder(), td = new TextDecoder(), S = crypto.subtle;
const b64 = buf => { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const rnd = n => crypto.getRandomValues(new Uint8Array(n));
async function pinKey(pin, salt, iter){ const base = await S.importKey('raw', te.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return S.deriveKey({name:'PBKDF2', salt:unb64(salt), iterations:iter, hash:'SHA-256'}, base, {name:'AES-GCM', length:256}, false, ['wrapKey','unwrapKey']); }
async function prfKey(out){ const base = await S.importKey('raw', out, 'HKDF', false, ['deriveKey']);
  return S.deriveKey({name:'HKDF', hash:'SHA-256', salt:new Uint8Array(32), info:te.encode('mis-documentos/huella/v1')}, base, {name:'AES-GCM', length:256}, false, ['wrapKey','unwrapKey']); }
async function wrap(k, kek){ const iv = rnd(12); return {iv:b64(iv), ct:b64(await S.wrapKey('raw', k, kek, {name:'AES-GCM', iv}))}; }
const unwrap = (w, kek, ext) => S.unwrapKey('raw', unb64(w.ct), kek, {name:'AES-GCM', iv:unb64(w.iv)}, {name:'AES-GCM'}, !!ext, ['encrypt','decrypt']);
async function enc(obj, id, key){ const iv = rnd(12); return {id, iv:b64(iv), ct:b64(await S.encrypt({name:'AES-GCM', iv, additionalData:te.encode(id)}, key, te.encode(JSON.stringify(obj))))}; }
async function dec(r, key){ return JSON.parse(td.decode(await S.decrypt({name:'AES-GCM', iv:unb64(r.iv), additionalData:te.encode(r.id)}, key, unb64(r.ct)))); }

/* ---------- Huella (WebAuthn + PRF) ---------- */
async function bioSupported(){ try { return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch(e){ return false; } }
async function bioCreate(){ const c = await navigator.credentials.create({publicKey:{challenge:rnd(32), rp:{name:'Mis documentos'}, user:{id:rnd(16), name:'Mis documentos', displayName:'Mis documentos'}, pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}], authenticatorSelection:{authenticatorAttachment:'platform', userVerification:'required', residentKey:'preferred'}, timeout:60000, attestation:'none', extensions:{prf:{}}}});
  if (!c) throw new Error('sin credencial'); return b64(c.rawId); }
async function bioKek(id, prfSalt){ const a = await navigator.credentials.get({publicKey:{challenge:rnd(32), allowCredentials:[{type:'public-key', id:unb64(id)}], userVerification:'required', timeout:60000, extensions:{prf:{eval:{first:unb64(prfSalt)}}}}});
  const r = a && a.getClientExtensionResults ? a.getClientExtensionResults() : {}; const out = r.prf && r.prf.results && r.prf.results.first;
  if (!out) { const e = new Error('noprf'); e.noprf = true; throw e; } return prfKey(out); }

/* ---------- Estado ---------- */
let meta = null, dek = null, docs = [], view = {name:'list'}, hist = [], filter = 'all', query = '', searchOpen = false, focusQ = false, unlocked = false, revealed = null, revealTimer = null, draft = null, bioOK = false, hiddenAt = 0, lastAct = Date.now(), picking = false, confirmRes = null, promptRes = null, pendingKey = null;
const pad = {buf:'', busy:false, onDone:null};
const APP_VERSION = 3;
let bioBusy = false;
function autoBio(){ if (!unlocked && meta && meta.bio && bioOK && !bioBusy && document.visibilityState === 'visible' && $('[data-act="bio"]')) A.bio(); }
let installEvt = null;
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (unlocked && view.name === 'settings') render(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast('Bóveda instalada'); if (unlocked && view.name === 'settings') render(); });

function toast(m){ const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800); }
function openOverlay(html, cls){ ov.className = cls; ov.innerHTML = html; ov.hidden = false; document.body.style.overflow = 'hidden'; }
function closeOverlay(){ ov.hidden = true; ov.innerHTML = ''; ov.className = ''; document.body.style.overflow = ''; }
function confirmBox(title, text, ok){ return new Promise(res => { confirmRes = res; openOverlay(`<div class="sheet" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><p>${esc(text)}</p><button class="btn btn-danger" data-act="confirmOk">${esc(ok)}</button><button class="btn btn-ghost" data-act="confirmNo">Cancelar</button></div>`, 'dim'); }); }

/* ---------- Teclado de PIN ---------- */
const cancelBtn = `<button class="btn btn-ghost narrow center" data-act="cancelPrompt">Cancelar</button>`;
function padHTML(title, sub, bioBtn, extra){ return `<div class="lock"><div class="lock-mark">${ic('lock',28)}</div><h1 class="lock-title">${esc(title)}</h1><p class="lock-sub" id="padSub">${esc(sub)}</p>${bioBtn?`<button class="bio-btn" data-act="bio">${ic('finger',20)} Usar huella</button>`:''}<div class="dots" id="dots" aria-hidden="true">${'<i></i>'.repeat(PIN_LEN)}</div><div class="pad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="key" data-key="${n}">${n}</button>`).join('')}<span></span><button class="key" data-key="0">0</button><button class="key key-ghost" data-key="del" aria-label="Borrar">${ic('back',24)}</button></div>${extra||''}</div>`; }
function newPad(fn){ pad.buf = ''; pad.busy = false; pad.onDone = fn; }
function drawDots(){ const d = $('#dots'); if (d) [...d.children].forEach((i,n) => i.classList.toggle('f', n < pad.buf.length)); }
function setSub(t){ const s = $('#padSub'); if (s) s.textContent = t; }
async function padKey(k){
  if (pad.busy) return;
  if (k === 'del'){ pad.buf = pad.buf.slice(0,-1); return drawDots(); }
  if (pad.buf.length >= PIN_LEN) return;
  pad.buf += k; drawDots();
  if (pad.buf.length === PIN_LEN){ pad.busy = true; let ok = false; try { ok = await pad.onDone(pad.buf); } catch(e){ ok = false; } pad.busy = false;
    if (!ok){ const d = $('#dots'); if (d){ d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); } setTimeout(() => { pad.buf = ''; drawDots(); }, 380); } } }
const weakPin = p => /^(\d)\1+$/.test(p) || '0123456789'.includes(p) || '9876543210'.includes(p);

/* ---------- Intentos fallidos ---------- */
function waitLeft(){ return Math.max(0, +(LS.get('md_until')||0) - Date.now()); }
function failed(){ const f = +(LS.get('md_fails')||0) + 1; LS.set('md_fails', f); if (f >= 3){ const s = Math.min(300, 5 * 2 ** (f-3)); LS.set('md_until', Date.now() + s*1000); return s; } return 0; }
function succeeded(){ LS.del('md_fails'); LS.del('md_until'); }
async function verifyPin(p, ext){
  const w = waitLeft(); if (w){ const e = new Error(); e.msg = `Espera ${Math.ceil(w/1000)} segundos para intentarlo de nuevo.`; throw e; }
  setSub('Verificando…');
  try { const k = await unwrap(meta.pin, await pinKey(p, meta.salt, meta.iter), ext); succeeded(); return k; }
  catch(err){ const s = failed(); const e = new Error(); e.msg = s ? `PIN incorrecto. Espera ${s} segundos.` : 'PIN incorrecto. Inténtalo otra vez.'; throw e; } }
function pinPrompt(title, sub, fn){ return new Promise(res => { promptRes = res; openOverlay(padHTML(title, sub, false, cancelBtn), 'full');
  newPad(async p => { try { const v = await fn(p); closeOverlay(); promptRes = null; res(v); return true; } catch(e){ setSub(e.msg || 'PIN incorrecto.'); return false; } }); }); }

/* ---------- Flujo de PIN nuevo ---------- */
function newPinFlow(el, done, cancelable){
  const extra = cancelable ? cancelBtn : '';
  const step1 = (msg) => { el.innerHTML = padHTML('Crea tu PIN', msg || 'Seis dígitos. Si lo olvidas, no hay forma de recuperar tus documentos.', false, extra);
    newPad(async p => { if (weakPin(p)){ setSub('Ese PIN es muy fácil de adivinar. Elige otro.'); return false; } step2(p); return true; }); };
  const step2 = first => { el.innerHTML = padHTML('Confirma tu PIN', 'Escríbelo otra vez.', false, extra);
    newPad(async p => { if (p !== first){ step1('Los PIN no coinciden. Inténtalo de nuevo.'); return true; } setSub('Cifrando…'); await done(p); return true; }); };
  step1(); }
async function setupKeys(pin){
  const salt = b64(rnd(16)), k = await S.generateKey({name:'AES-GCM', length:256}, true, ['encrypt','decrypt']);
  meta = {k:'keys', v:1, salt, iter:ITER, pin:await wrap(k, await pinKey(pin, salt, ITER)), bio:null};
  await DB.put('meta', meta); dek = k; pendingKey = k; renderBioOffer(); }
async function enableBio(extKey){
  const id = await bioCreate(), prfSalt = b64(rnd(32));
  const kek = await bioKek(id, prfSalt);
  meta.bio = {id, prfSalt, w:await wrap(extKey, kek)}; await DB.put('meta', meta); }

/* ---------- Pantallas de bloqueo ---------- */
function renderBioOffer(){ main.innerHTML = `<div class="lock"><div class="lock-mark">${ic('finger',30)}</div><h1 class="lock-title">Abre con tu huella</h1><p class="lock-sub">${bioOK?'Tu huella también podrá descifrar tus documentos. Te la pedirá dos veces para configurarla.':'Este navegador no permite usar la huella, así que la app se abrirá con tu PIN.'}</p>${bioOK?`<button class="btn btn-primary narrow" data-act="bioOn">Activar huella</button><button class="btn btn-ghost narrow" data-act="bioSkip">Ahora no</button>`:`<button class="btn btn-primary narrow" data-act="bioSkip">Continuar</button>`}</div>`; }
function renderLock(){
  unlocked = false;
  if (!meta) return newPinFlow(main, setupKeys, false);
  const bio = !!meta.bio && bioOK;
  main.innerHTML = padHTML('Bóveda', bio ? 'Desbloquea con tu huella o tu PIN.' : 'Ingresa tu PIN.', bio, `<button class="btn-link" data-act="forgot">Olvidé mi PIN</button>`);
  newPad(async p => { try { dek = await verifyPin(p, false); await afterUnlock(); return true; } catch(e){ setSub(e.msg || 'PIN incorrecto.'); return false; } }); }
async function afterUnlock(){
  pendingKey = null; unlocked = true; lastAct = Date.now(); docs = []; let bad = 0;
  for (const r of await DB.all('docs')){ try { const d = clean(await dec(r, dek), r.id); if (d) docs.push(d); else bad++; } catch(e){ bad++; } }
  view = {name:'list'}; hist = []; filter = 'all'; query = ''; searchOpen = false; render(); window.scrollTo(0,0);
  if (bad) toast(`${bad} registro${bad>1?'s':''} no se pudo${bad>1?'ieron':''} leer.`); }
function lock(){
  dek = null; pendingKey = null; docs = []; draft = null; revealed = null; clearTimeout(revealTimer);
  if (promptRes){ promptRes(null); promptRes = null; } if (confirmRes){ confirmRes(false); confirmRes = null; }
  closeOverlay(); renderLock(); window.scrollTo(0,0); }

/* ---------- Validación de datos ---------- */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, ID_RE = /^[a-z0-9]{6,40}$/;
const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
function clean(d, id){ if (!d || typeof d !== 'object' || !ID_RE.test(id)) return null;
  const name = str(d.name, 120).trim(); if (!name) return null;
  return {id, name, cat:Object.prototype.hasOwnProperty.call(CATS, d.cat) ? d.cat : 'otros', num:str(d.num,80), issued:DATE_RE.test(d.issued)?d.issued:'', exp:DATE_RE.test(d.exp)?d.exp:'', noexp:!!d.noexp, warn:WARNS.includes(+d.warn)?+d.warn:30, loc:str(d.loc,200), notes:str(d.notes,2000), front:typeof d.front==='string'&&IMG_RE.test(d.front)?d.front:null, back:typeof d.back==='string'&&IMG_RE.test(d.back)?d.back:null, updated:+d.updated||Date.now()}; }

/* ---------- Navegación ---------- */
function go(v){ hist.push(view); view = v; render(); window.scrollTo(0,0); }
function back(){ view = hist.pop() || {name:'list'}; render(); window.scrollTo(0,0); }
const cur = () => docs.find(d => d.id === view.id);

/* ---------- Vistas ---------- */
function cardHTML(d, big){ const s = status(d), tag = big ? 'div' : 'button';
  return `<${tag} class="card c-${d.cat}" ${big?'':`data-open="${esc(d.id)}" aria-label="${esc(d.name)}. ${esc(s.t)}"`}><div class="card-top"><div><span class="card-cat">${esc(CATS[d.cat])}</span><span class="card-name">${esc(d.name)}</span></div><span class="pill pill-${s.k}"><i></i>${esc(s.t)}</span></div><div class="card-bottom"><span class="card-num">${esc(mask(d.num))}</span><span>${d.exp?'Vence '+esc(fmtD(d.exp)):''}</span></div></${tag}>`; }
function filtered(){ let l = sorted(docs);
  if (filter === 'att') l = l.filter(isAtt); else if (filter !== 'all') l = l.filter(d => d.cat === filter);
  const q = norm(query.trim()); if (q) l = l.filter(d => norm([d.name, d.num, CATS[d.cat], d.loc, d.notes].join(' ')).includes(q));
  return l; }
function stackHTML(){ const l = filtered(); return l.length ? `<div class="stack">${l.map(d => cardHTML(d)).join('')}</div>` : `<p class="empty-sm">No hay documentos que coincidan.</p>`; }
function viewList(){
  const cats = Object.keys(CATS).filter(k => docs.some(d => d.cat === k)), att = docs.filter(isAtt), bad = att.filter(d => status(d).k === 'bad').length;
  if (filter !== 'all' && filter !== 'att' && !cats.includes(filter)) filter = 'all';
  if (filter === 'att' && !att.length) filter = 'all';
  let h = `<header class="bar"><h1 class="title">Mis documentos</h1><div class="bar-actions">${docs.length?`<button class="icon-btn" data-act="toggleSearch" aria-label="Buscar">${ic('search')}</button>`:''}<button class="icon-btn" data-act="settings" aria-label="Ajustes">${ic('gear')}</button><button class="icon-btn icon-btn-solid" data-act="new" aria-label="Agregar documento">${ic('plus')}</button></div></header>`;
  if (searchOpen) h += `<div class="search"><input id="q" type="search" placeholder="Buscar por nombre, número o lugar" value="${esc(query)}" aria-label="Buscar" ${NO_SPELL}></div>`;
  if (!docs.length) return h + `<div class="empty"><div class="empty-card">${ic('plus',28)}</div><h2>Agrega tu primer documento</h2><p>Guarda tu DUI, pasaporte o licencia con sus fotos y fechas. La app te avisa antes de que venzan.</p><button class="btn btn-primary" data-act="new">Agregar documento</button></div>`;
  if (att.length && filter !== 'att'){ const w = att.length - bad, parts = []; if (bad) parts.push(`${bad} vencido${bad>1?'s':''}`); if (w) parts.push(`${w} por vencer`);
    h += `<button class="note ${bad?'note-bad':'note-warn'} note-btn" data-filter="att">${att.length===1?'Un documento necesita':att.length+' documentos necesitan'} atención: ${parts.join(' y ')}</button>`; }
  h += `<div class="chips"><button class="chip ${filter==='all'?'on':''}" data-filter="all">Todos</button>${att.length?`<button class="chip ${filter==='att'?'on':''}" data-filter="att">Por atender</button>`:''}${cats.map(k=>`<button class="chip ${filter===k?'on':''}" data-filter="${k}">${CATS[k]}</button>`).join('')}</div>`;
  return h + `<div id="stackWrap">${stackHTML()}</div>`; }
const row = (l, v, block) => `<div class="row${block?' row-block':''}"><dt>${esc(l)}</dt><dd>${esc(v)}</dd></div>`;
function viewDetail(){ const d = cur(); if (!d){ view = {name:'list'}; return viewList(); }
  const s = status(d), shown = revealed === d.id;
  const photo = (side, label) => d[side] ? `<button class="photo" data-view="${side}" aria-label="Ver ${label.toLowerCase()} en grande"><img src="${d[side]}" alt="${label}"></button>` : `<button class="photo photo-empty" data-act="edit">${ic('camera')}<span>Agregar ${label.toLowerCase()}</span></button>`;
  return `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Volver">${ic('back')}</button><div class="bar-actions">${navigator.share&&(d.front||d.back)?`<button class="icon-btn" data-act="share" aria-label="Compartir fotos">${ic('share')}</button>`:''}<button class="icon-btn" data-act="edit" aria-label="Editar">${ic('edit')}</button></div></header>
  <div class="detail-card">${cardHTML(d, true)}</div>
  ${s.k==='warn'?`<div class="note note-warn">${esc(s.t)}. Es buen momento para empezar el trámite.</div>`:s.k==='bad'?`<div class="note note-bad">Este documento ya venció.</div>`:''}
  <div class="photos">${photo('front','Frente')}${photo('back','Reverso')}</div>
  <dl class="rows">
  ${d.num?`<div class="row"><dt>Número</dt><dd><span>${esc(shown?d.num:mask(d.num))}</span><button class="mini" data-act="reveal" aria-label="${shown?'Ocultar número':'Ver número completo'}">${ic(shown?'eyeoff':'eye',18)}</button></dd></div>`:''}
  ${d.issued?row('Emitido', fmtD(d.issued)):''}${d.exp?row('Vence', fmtD(d.exp)):''}${d.exp?row('Aviso', `${d.warn} días antes`):''}${d.loc?row('Dónde está el original', d.loc):''}${d.notes?row('Notas', d.notes, true):''}
  ${!d.num&&!d.issued&&!d.exp&&!d.loc&&!d.notes?row('Detalles','Sin datos todavía'):''}
  </dl><button class="btn btn-danger-text" data-act="delete">Eliminar documento</button>`; }
function formPhoto(side, label){ return `<div class="photo-slot" id="ps_${side}">${draft[side]?`<img src="${draft[side]}" alt="${label}"><button type="button" class="photo-x" data-rmphoto="${side}" aria-label="Quitar foto del ${label.toLowerCase()}">${ic('x',16)}</button>`:`<label class="photo photo-empty" data-pick>${ic('camera')}<span>${label}</span><input type="file" accept="image/*" data-photo="${side}" hidden></label>`}</div>`; }
const updatePhotoSlot = side => { const el = $('#ps_'+side); if (el) el.outerHTML = formPhoto(side, side === 'front' ? 'Frente' : 'Reverso'); };
function viewForm(){ const d = draft;
  return `<header class="bar"><button class="icon-btn" data-act="cancelForm" aria-label="Cancelar">${ic('x')}</button><h1 class="title title-sm">${d._new?'Nuevo documento':'Editar documento'}</h1><button class="btn-save" data-act="save">Guardar</button></header>
  <div>
  <label class="field"><span>Nombre</span><input id="f_name" list="sugs" value="${esc(d.name)}" placeholder="Pasaporte" maxlength="120" ${NO_SPELL}><datalist id="sugs">${Object.keys(SUG).map(k=>`<option value="${k}">`).join('')}</datalist><em class="err" id="e_name"></em></label>
  <div class="field"><span>Categoría</span><div class="cat-pick">${Object.entries(CATS).map(([k,n])=>`<button type="button" class="cat-opt c-${k}${d.cat===k?' on':''}" data-cat="${k}">${n}</button>`).join('')}</div></div>
  <label class="field"><span>Número</span><input id="f_num" value="${esc(d.num)}" placeholder="01234567-8" maxlength="80" ${NO_SPELL}></label>
  <div class="two"><label class="field"><span>Emitido</span><input id="f_issued" type="date" value="${d.issued||''}"></label><label class="field"><span>Vence</span><input id="f_exp" type="date" value="${d.exp||''}" ${d.noexp?'disabled':''}></label></div>
  <label class="check"><input type="checkbox" id="f_noexp" ${d.noexp?'checked':''}> Este documento no vence</label>
  <label class="field" id="warnField" ${d.noexp?'hidden':''}><span>Avisarme</span><select id="f_warn">${WARNS.map(n=>`<option value="${n}" ${d.warn===n?'selected':''}>${n} días antes</option>`).join('')}</select></label>
  <label class="field"><span>Dónde está el original</span><input id="f_loc" value="${esc(d.loc)}" placeholder="Gaveta del escritorio" maxlength="200" ${NO_SPELL}></label>
  <label class="field"><span>Notas</span><textarea id="f_notes" rows="3" placeholder="Requisitos para renovarlo, lugar de emisión" maxlength="2000" ${NO_SPELL}>${esc(d.notes)}</textarea></label>
  <div class="field"><span>Fotos</span><div class="photos">${formPhoto('front','Frente')}${formPhoto('back','Reverso')}</div></div>
  </div>`; }
function viewSettings(){ const bio = !!meta.bio;
  return `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Volver">${ic('back')}</button><h1 class="title title-sm">Ajustes</h1><span class="spacer"></span></header>
  <h2 class="section">Seguridad</h2><div class="rows">
  ${bioOK?`<button class="set-row" data-act="toggleBio" role="switch" aria-checked="${bio}"><span>Abrir con huella<small>También se pide para ver números completos</small></span><span class="sw ${bio?'on':''}"></span></button>`:`<p class="fine">Este navegador no permite usar la huella. La app usa tu PIN.</p>`}
  <button class="set-row" data-act="changePin"><span>Cambiar PIN</span><span class="chev">${ic('chev',18)}</span></button>
  <button class="set-row" data-act="lockNow"><span>Bloquear ahora</span><span class="chev">${ic('lock',18)}</span></button></div>
  <h2 class="section">Instalación</h2><div class="rows">${isStandalone()?`<p class="fine">Ya estás usando la app instalada.</p>`:installEvt?`<button class="set-row" data-act="install"><span>Instalar Bóveda en el celular<small>Queda como una app con su propio ícono</small></span><span class="chev">${ic('down',18)}</span></button>`:`<p class="fine">Chrome todavía no ofrece instalarla. Abre la app en Chrome con internet, espera unos segundos y vuelve a entrar aquí.</p>`}</div>
  <h2 class="section">Copia de seguridad</h2><div class="rows">
  <button class="set-row" data-act="exportBk"><span>Descargar copia cifrada<small>Solo se puede abrir con tu PIN actual</small></span><span class="chev">${ic('down',18)}</span></button>
  <label class="set-row" data-pick><span>Restaurar una copia<small>Te pedirá el PIN que tenías al hacerla</small></span><span class="chev">${ic('up',18)}</span><input type="file" accept="application/json,.json" data-import hidden></label></div>
  <h2 class="section">Privacidad</h2><div class="rows"><p class="fine">Tus documentos y fotos se guardan cifrados solo en este celular. La app no se conecta a internet para nada: no envía ni recibe datos.</p><p class="fine">Los avisos de vencimiento aparecen al abrir la app. La app se bloquea sola si sales de ella o la dejas de usar unos minutos.</p></div>
  <button class="btn btn-danger-text mt" data-act="wipe">Borrar todos los documentos</button><p class="fine">Versión ${APP_VERSION}</p>`; }
function render(){ if (!unlocked) return;
  main.innerHTML = ({list:viewList, detail:viewDetail, form:viewForm, settings:viewSettings}[view.name] || viewList)();
  if (focusQ){ focusQ = false; const q = $('#q'); if (q) q.focus(); } }

/* ---------- Imágenes ---------- */
function compress(file){ return new Promise((res, rej) => { if (file.size > 40e6) return rej(); const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => { const m = 1500, s = Math.min(1, m / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width*s); c.height = Math.round(img.height*s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', .82)); };
  img.onerror = () => { URL.revokeObjectURL(url); rej(); }; img.src = url; }); }
function d2b(u){ const [h, b] = u.split(','), m = (h.match(/:(.*?);/)||[])[1] || 'image/jpeg', a = unb64(b); return new Blob([a], {type:m}); }
async function saveDoc(doc){ await DB.put('docs', await enc(doc, doc.id, dek)); }

/* ---------- Acciones ---------- */
const A = {
  toggleSearch(){ searchOpen = !searchOpen; if (!searchOpen) query = ''; focusQ = searchOpen; render(); },
  settings(){ go({name:'settings'}); },
  new(){ draft = {_new:true, name:'', cat:'identidad', num:'', issued:'', exp:'', noexp:false, warn:30, loc:'', notes:'', front:null, back:null}; go({name:'form'}); },
  edit(){ const d = cur(); if (!d) return; draft = {...d, _catTouched:true}; go({name:'form'}); },
  back(){ back(); },
  cancelForm(){ draft = null; back(); },
  async save(){ const name = $('#f_name').value.trim(); if (!name){ $('#e_name').textContent = 'Escribe el nombre del documento.'; $('#f_name').focus(); return; }
    const noexp = $('#f_noexp').checked;
    const doc = clean({name, cat:draft.cat, num:$('#f_num').value.trim(), issued:$('#f_issued').value, exp:noexp?'':$('#f_exp').value, noexp, warn:+$('#f_warn').value, loc:$('#f_loc').value.trim(), notes:$('#f_notes').value.trim(), front:draft.front, back:draft.back, updated:Date.now()}, draft.id || uid());
    try { await saveDoc(doc); } catch(e){ toast('No se pudo guardar. Puede que falte espacio en el celular.'); return; }
    const i = docs.findIndex(x => x.id === doc.id); i < 0 ? docs.push(doc) : docs[i] = doc;
    const isNew = draft._new; draft = null; toast('Documento guardado');
    if (isNew){ view = {name:'detail', id:doc.id}; render(); window.scrollTo(0,0); } else back(); },
  async delete(){ const d = cur(); if (!d) return; if (!await confirmBox(`¿Eliminar ${d.name}?`, 'Se borran sus datos y fotos de este celular.', 'Eliminar')) return;
    try { await DB.del('docs', d.id); } catch(e){ toast('No se pudo eliminar.'); return; }
    docs = docs.filter(x => x.id !== d.id); hist = hist.filter(v => v.id !== d.id); toast('Documento eliminado'); back(); },
  async reveal(){ const d = cur(); if (!d) return; clearTimeout(revealTimer);
    if (revealed === d.id){ revealed = null; return render(); }
    if (await reauth('Para ver el número completo.')){ revealed = d.id; render(); revealTimer = setTimeout(() => { revealed = null; if (unlocked && view.name === 'detail') render(); }, 20000); } },
  async share(){ const d = cur(); if (!d) return; const files = [];
    for (const s of ['front','back']) if (d[s]) files.push(new File([d2b(d[s])], `${d.name} ${s==='front'?'frente':'reverso'}.jpg`, {type:'image/jpeg'}));
    try { if (navigator.canShare && navigator.canShare({files})) await navigator.share({files, title:d.name}); else toast('Tu navegador no permite compartir fotos desde aquí.'); } catch(e){ if (e && e.name !== 'AbortError') toast('No se pudo compartir.'); } },
  closeViewer(){ closeOverlay(); },
  confirmOk(){ closeOverlay(); if (confirmRes){ confirmRes(true); confirmRes = null; } },
  confirmNo(){ closeOverlay(); if (confirmRes){ confirmRes(false); confirmRes = null; } },
  cancelPrompt(){ closeOverlay(); if (promptRes){ promptRes(null); promptRes = null; } if (!unlocked && meta) renderLock(); },
  async bio(){ if (bioBusy) return; bioBusy = true; try { dek = await unwrap(meta.bio.w, await bioKek(meta.bio.id, meta.bio.prfSalt), false); succeeded(); await afterUnlock(); }
    catch(e){ setSub(e.noprf ? 'Tu huella no pudo descifrar los datos. Usa tu PIN.' : 'Toca «Usar huella» para intentarlo otra vez o usa tu PIN.'); }
    finally { bioBusy = false; } },
  async bioOn(){ try { await enableBio(pendingKey); toast('Huella activada'); } catch(e){ meta.bio = null; toast(e.noprf ? 'Tu celular no permite usar la huella para cifrar. Usarás tu PIN.' : 'No se pudo activar la huella. Puedes intentarlo después en Ajustes.'); } await afterUnlock(); },
  async bioSkip(){ await afterUnlock(); },
  async toggleBio(){
    if (meta.bio){ meta.bio = null; await DB.put('meta', meta); toast('Huella desactivada'); return render(); }
    const k = await pinPrompt('Confirma tu PIN', 'Para activar la huella.', p => verifyPin(p, true)); if (!k) return;
    try { await enableBio(k); toast('Huella activada'); } catch(e){ meta.bio = null; toast(e.noprf ? 'Tu celular no permite usar la huella para cifrar.' : 'No se pudo activar la huella.'); }
    render(); },
  async changePin(){
    const k = await pinPrompt('PIN actual', 'Escribe tu PIN actual.', p => verifyPin(p, true)); if (!k) return;
    openOverlay('', 'full');
    newPinFlow(ov, async pin => { const salt = b64(rnd(16)); const w = await wrap(k, await pinKey(pin, salt, ITER));
      meta.salt = salt; meta.iter = ITER; meta.pin = w; await DB.put('meta', meta); closeOverlay(); toast('PIN actualizado'); }, true); },
  lockNow(){ lock(); },
  async install(){ if (!installEvt) return; const e = installEvt; installEvt = null; try { await e.prompt(); await e.userChoice; } catch(err){} render(); },
  async exportBk(){ const data = {app:'mis-documentos', v:1, created:new Date().toISOString(), salt:meta.salt, iter:meta.iter, pin:meta.pin, docs:await DB.all('docs')};
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:'application/json'})), a = document.createElement('a');
    a.href = url; a.download = `mis-documentos-copia-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000); toast('Copia cifrada descargada'); },
  async wipe(){ if (!await confirmBox('¿Borrar todos los documentos?', 'Se eliminan todos tus documentos y fotos de este celular. No se puede deshacer.', 'Borrar todo')) return;
    await DB.clear('docs'); docs = []; view = {name:'list'}; hist = []; toast('Documentos borrados'); render(); },
  async forgot(){ if (!await confirmBox('¿Empezar de cero?', 'Sin tu PIN no hay forma de descifrar tus documentos. Se borrarán todos y crearás un PIN nuevo.', 'Borrar y empezar')) return;
    await DB.clear('docs'); await DB.clear('meta'); meta = null; succeeded(); renderLock(); }
};
async function reauth(reason){
  if (meta.bio && bioOK){ try { await unwrap(meta.bio.w, await bioKek(meta.bio.id, meta.bio.prfSalt), false); return true; } catch(e){} }
  return !!(await pinPrompt('Confirma que eres tú', reason, p => verifyPin(p, false))); }
async function importBk(file){
  let data; try { if (file.size > 300e6) throw 0; data = JSON.parse(await file.text()); } catch(e){ return toast('Ese archivo no es una copia válida.'); }
  if (!data || data.app !== 'mis-documentos' || !Array.isArray(data.docs) || typeof data.salt !== 'string' || !data.pin || !(data.iter >= 100000 && data.iter <= 5000000)) return toast('Ese archivo no es una copia válida.');
  const k = await pinPrompt('PIN de la copia', 'El que tenías cuando hiciste la copia.', async p => { setSub('Verificando…'); try { return await unwrap(data.pin, await pinKey(p, data.salt, data.iter), false); } catch(e){ const er = new Error(); er.msg = 'Ese no es el PIN de la copia.'; throw er; } });
  if (!k || !unlocked) return;
  let n = 0, bad = 0;
  for (const r of data.docs){ try { if (!r || !ID_RE.test(r.id)) throw 0; const d = clean(await dec(r, k), r.id); if (!d) throw 0; await saveDoc(d); const i = docs.findIndex(x => x.id === d.id); i < 0 ? docs.push(d) : docs[i] = d; n++; } catch(e){ bad++; } }
  render(); toast(n ? `${n} documento${n>1?'s':''} restaurado${n>1?'s':''}${bad?`, ${bad} con errores`:''}` : 'No se pudo restaurar ningún documento.'); }

/* ---------- Eventos ---------- */
document.addEventListener('click', e => {
  if (e.target.closest('[data-pick]')) picking = true;
  const t = e.target.closest('[data-key],[data-act],[data-open],[data-view],[data-cat],[data-filter],[data-rmphoto]'); if (!t) return;
  const ds = t.dataset;
  if (ds.key !== undefined) return padKey(ds.key);
  if (!unlocked && !['bio','bioOn','bioSkip','forgot','confirmOk','confirmNo','cancelPrompt'].includes(ds.act)) return;
  if (ds.open) return go({name:'detail', id:ds.open});
  if (ds.view){ const d = cur(); if (d && d[ds.view]) openOverlay(`<img src="${d[ds.view]}" alt="" data-act="closeViewer"><button class="viewer-close" data-act="closeViewer" aria-label="Cerrar">${ic('x')}</button>`, 'viewer'); return; }
  if (ds.cat){ draft.cat = ds.cat; draft._catTouched = true; document.querySelectorAll('.cat-opt').forEach(b => b.classList.toggle('on', b === t)); return; }
  if (ds.filter){ filter = ds.filter; return render(); }
  if (ds.rmphoto){ draft[ds.rmphoto] = null; return updatePhotoSlot(ds.rmphoto); }
  if (ds.act && A[ds.act]) A[ds.act](t);
});
document.addEventListener('change', async e => { const t = e.target; picking = false; lastAct = Date.now();
  if (t.dataset && t.dataset.photo){ const f = t.files && t.files[0]; if (!f || !draft) return; const side = t.dataset.photo;
    try { draft[side] = await compress(f); updatePhotoSlot(side); } catch(err){ toast('No se pudo cargar la foto. Prueba con otra.'); } }
  if (t.dataset && t.dataset.import !== undefined){ const f = t.files && t.files[0]; t.value = ''; if (f) importBk(f); }
  if (t.id === 'f_noexp'){ $('#f_exp').disabled = t.checked; $('#warnField').hidden = t.checked; } });
document.addEventListener('input', e => { const t = e.target;
  if (t.id === 'q'){ query = t.value; const w = $('#stackWrap'); if (w) w.innerHTML = stackHTML(); }
  if (t.id === 'f_name'){ $('#e_name').textContent = ''; const key = Object.keys(SUG).find(k => norm(k) === norm(t.value.trim()));
    if (key){ const [c, w] = SUG[key]; if (!draft._catTouched){ draft.cat = c; document.querySelectorAll('.cat-opt').forEach(b => b.classList.toggle('on', b.dataset.cat === c)); } $('#f_warn').value = String(w); } } });
document.addEventListener('keydown', e => { lastAct = Date.now();
  if (!ov.hidden && e.key === 'Escape'){ if (confirmRes) A.confirmNo(); else if (promptRes) A.cancelPrompt(); else if (ov.classList.contains('viewer')) closeOverlay(); return; }
  if ($('#dots') && (!unlocked || !ov.hidden)){ if (/^[0-9]$/.test(e.key)) padKey(e.key); else if (e.key === 'Backspace') padKey('del'); } });
document.addEventListener('pointerdown', () => { lastAct = Date.now(); }, {passive:true});
document.addEventListener('visibilitychange', () => {
  if (document.hidden){ hiddenAt = Date.now(); document.body.classList.add('veil'); return; }
  const away = Date.now() - hiddenAt;
  if (unlocked && away > (picking ? LOCK_PICKING_MS : LOCK_HIDDEN_MS)) lock();
  document.body.classList.remove('veil');
  setTimeout(autoBio, 250); });
window.addEventListener('pageshow', e => { if (e.persisted) setTimeout(autoBio, 250); });
window.addEventListener('focus', () => { setTimeout(() => { picking = false; }, 1500); });
window.addEventListener('pagehide', () => { if (unlocked) lock(); });
setInterval(() => { if (unlocked && !picking && Date.now() - lastAct > LOCK_IDLE_MS) lock(); }, 10000);

/* ---------- Inicio ---------- */
(async () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', {scope:'./'}).catch(() => {});
  if (!window.isSecureContext || !crypto.subtle || !window.indexedDB){ main.innerHTML = `<div class="fatal"><h1>No se puede abrir</h1><p>Abre la app desde su dirección https en Chrome o Safari.</p></div>`; return; }
  bioOK = await bioSupported();
  if (!await DB.open()){ main.innerHTML = `<div class="fatal"><h1>No se puede guardar</h1><p>Este navegador no permite guardar datos. Si estás en modo incógnito, ábrela en una pestaña normal.</p></div>`; return; }
  try { meta = await DB.get('meta', 'keys') || null; } catch(e){ meta = null; }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  renderLock();
  setTimeout(autoBio, 300);
})();
})();
