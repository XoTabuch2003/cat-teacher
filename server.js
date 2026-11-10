'use strict';
// Школа англійської мови Cat teacher — сервер без зовнішніх залежностей.
// Запуск: node server.js  (потрібен Node.js 18+)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UP_DIR = path.join(DATA_DIR, 'uploads');
const PUBLIC = path.join(__dirname, 'public');
const DB_FILE = path.join(DATA_DIR, 'db.json');
fs.mkdirSync(UP_DIR, { recursive: true });

const TOPICS = [
  'Everyday Life & Routines (Beginner – Elementary)',
  'Travel & Exploring (Pre-Intermediate)',
  'Work, Career & Projects (Intermediate)',
  'Hobbies, Creativity & Entertainment',
  'Society, Tech & Big Ideas',
];

function blank() {
  const id = () => crypto.randomBytes(5).toString('hex');
  return {
    users: [],
    sessions: {},
    topics: TOPICS,
    classes: ['1.4', '1.5', '1.6'].map((n) => ({ id: id(), name: 'Група ' + n, kind: 'group' })),
    links: [
      { id: id(), title: 'zoom', url: '', icon: 'zoom' },
      { id: id(), title: 'pdf', url: '', icon: 'pdf' },
      { id: id(), title: 'books', url: '', icon: 'books' },
      { id: id(), title: 'game', url: '', icon: 'game' },
    ],
    lessons: [],
    homework: [],
    submissions: [],
    settings: { studentLinks: true },
  };
}
let db = blank();
function loadDb() { try { db = Object.assign(blank(), JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch { db = blank(); } }
loadDb();
// ---- Збереження даних у приватному GitHub-репозиторії (для безкоштовного хостингу без постійного диска) ----
const GH = { token: process.env.GITHUB_TOKEN, repo: process.env.GITHUB_REPO, branch: process.env.GITHUB_BRANCH || 'main' };
const ghOn = !!(GH.token && GH.repo);
const ghHead = { Authorization: 'Bearer ' + GH.token, 'User-Agent': 'cat-teacher', 'X-GitHub-Api-Version': '2022-11-28' };
const ghUrl = (p) => `https://api.github.com/repos/${GH.repo}/contents/${p}`;
async function ghGetRaw(p) {
  const r = await fetch(`${ghUrl(p)}?ref=${GH.branch}`, { headers: { ...ghHead, Accept: 'application/vnd.github.raw+json' } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('GitHub ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
async function ghPut(p, buf) {
  let sha;
  const g = await fetch(`${ghUrl(p)}?ref=${GH.branch}`, { headers: ghHead });
  if (g.ok) sha = (await g.json()).sha;
  const r = await fetch(ghUrl(p), { method: 'PUT', headers: { ...ghHead, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'update ' + p, content: buf.toString('base64'), branch: GH.branch, sha }) });
  if (!r.ok) throw new Error(`GitHub ${r.status} ${(await r.text()).slice(0, 160)}`);
}
let ghQ = Promise.resolve(), ghTimer = null;
const ghEnqueue = (p, getBuf) => { ghQ = ghQ.then(() => ghPut(p, getBuf())).catch((e) => console.error('GitHub sync:', e.message)); return ghQ; };
const ghSchedule = () => { clearTimeout(ghTimer); ghTimer = setTimeout(() => ghEnqueue('db.json', () => Buffer.from(JSON.stringify(db))), 10000); };
async function ghFlush() { clearTimeout(ghTimer); ghEnqueue('db.json', () => Buffer.from(JSON.stringify(db))); await ghQ; }

let saveTimer = null;
function writeDb() { const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB_FILE); }
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { writeDb(); if (ghOn) ghSchedule(); }, 50);
}
function shutdown() {
  writeDb();
  if (!ghOn) process.exit(0);
  Promise.race([ghFlush(), new Promise((r) => setTimeout(r, 8000))]).finally(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const uid = () => crypto.randomBytes(6).toString('hex');
const S = (v, n = 500) => String(v ?? '').trim().slice(0, n);
const safeUrl = (u) => (/^(https?:\/\/|\/files\/)/i.test(u) ? S(u, 1000) : '');
const num = (v) => (v === null || v === '' || v === undefined || isNaN(+v) ? null : Math.max(0, Math.min(100, Math.round(+v))));

function hashPw(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function checkPw(pw, stored) {
  const [salt, h] = stored.split(':');
  const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(pw, salt, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const MIME = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain; charset=utf-8', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg',
  webm: 'audio/webm', mp4: 'video/mp4', mov: 'video/quicktime', json: 'application/json',
};
const UPLOAD_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'doc', 'docx', 'txt', 'mp3', 'm4a', 'wav', 'ogg', 'webm', 'mp4', 'mov']);

function send(res, code, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
const fail = (status, error) => Object.assign(new Error(error), { status });

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0, over = false;
    req.on('data', (c) => { n += c.length; if (n > limit) over = true; else chunks.push(c); });
    req.on('end', () => (over ? reject(fail(413, 'Файл завеликий')) : resolve(Buffer.concat(chunks))));
    req.on('error', reject);
  });
}
async function readJson(req) {
  const b = await readBody(req, 2_000_000);
  try { return b.length ? JSON.parse(b.toString('utf8')) : {}; } catch { throw fail(400, 'Некоректні дані'); }
}

function getUser(req) {
  const m = /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
  const uidv = m && db.sessions[m[1]];
  return uidv ? db.users.find((u) => u.id === uidv) || null : null;
}
function startSession(req, res, user) {
  const sid = crypto.randomBytes(24).toString('hex');
  db.sessions[sid] = user.id; save();
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return { 'Set-Cookie': `sid=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${secure}` };
}

const tries = new Map();
function throttle(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress, now = Date.now();
  const arr = (tries.get(ip) || []).filter((t) => now - t < 600000);
  arr.push(now); tries.set(ip, arr);
  if (arr.length > 25) throw fail(429, 'Забагато спроб. Спробуйте за кілька хвилин.');
}

const pub = (u) => ({ id: u.id, name: u.name, role: u.role, classId: u.classId || null, photoUrl: u.photoUrl || '' });

function bootstrap(me) {
  const teacher = db.users.find((u) => u.role === 'teacher');
  const base = {
    me: pub(me),
    teacher: teacher ? { name: teacher.name, photoUrl: teacher.photoUrl || '' } : null,
    classes: db.classes, links: db.links, topics: db.topics, settings: db.settings,
  };
  if (me.role === 'teacher') {
    return { ...base, users: db.users.filter((u) => u.role === 'student').map(pub),
      lessons: db.lessons, homework: db.homework, submissions: db.submissions };
  }
  return { ...base, users: [pub(me)],
    lessons: db.lessons.filter((l) => l.classId === me.classId),
    homework: db.homework.filter((h) => h.classId === me.classId),
    submissions: db.submissions.filter((s) => s.userId === me.id) };
}

const need = (user, role) => { if (!user) throw fail(401, 'Потрібно увійти'); if (role && user.role !== role) throw fail(403, 'Недостатньо прав'); };
const findClass = (id) => db.classes.find((c) => c.id === id);

async function api(req, res, url) {
  const route = req.method + ' ' + url.pathname.replace(/^\/api/, '');
  const user = getUser(req);
  let m;

  if (route === 'GET /status') return send(res, 200, { setup: !db.users.some((u) => u.role === 'teacher'), user: user ? pub(user) : null, needCode: !!process.env.SETUP_CODE,
    classes: db.classes.map((c) => ({ id: c.id, name: c.name, kind: c.kind })) });

  if (route === 'POST /setup') {
    if (db.users.some((u) => u.role === 'teacher')) throw fail(403, 'Вчителя вже створено');
    const b = await readJson(req);
    if (process.env.SETUP_CODE && S(b.code, 100) !== process.env.SETUP_CODE) throw fail(403, 'Невірний код запуску');
    if (S(b.name).length < 2 || S(b.password, 100).length < 6) throw fail(400, 'Імʼя та пароль (від 6 символів) обовʼязкові');
    const t = { id: uid(), name: S(b.name, 60), role: 'teacher', pw: hashPw(S(b.password, 100)), photoUrl: '' };
    db.users.push(t);
    return send(res, 200, { ok: true }, startSession(req, res, t));
  }
  if (route === 'POST /register') {
    throttle(req);
    const b = await readJson(req);
    const name = S(b.name, 60), pw = S(b.password, 100);
    if (name.length < 2) throw fail(400, 'Введіть імʼя та прізвище');
    if (pw.length < 4) throw fail(400, 'Пароль від 4 символів');
    if (!findClass(b.classId)) throw fail(400, 'Оберіть групу');
    if (db.users.some((u) => u.name.toLowerCase() === name.toLowerCase())) throw fail(400, 'Таке імʼя вже зареєстроване. Увійдіть або додайте щось до імені.');
    const u = { id: uid(), name, role: 'student', classId: b.classId, pw: hashPw(pw), photoUrl: '' };
    db.users.push(u);
    return send(res, 200, { ok: true }, startSession(req, res, u));
  }
  if (route === 'POST /login') {
    throttle(req);
    const b = await readJson(req);
    const u = db.users.find((x) => x.name.toLowerCase() === S(b.name, 60).toLowerCase());
    if (!u || !checkPw(S(b.password, 100), u.pw)) throw fail(401, 'Невірне імʼя або пароль');
    return send(res, 200, { ok: true }, startSession(req, res, u));
  }
  if (route === 'POST /logout') {
    const m2 = /sid=([a-f0-9]+)/.exec(req.headers.cookie || ''); if (m2) { delete db.sessions[m2[1]]; save(); }
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; Path=/; Max-Age=0' });
  }

  need(user);

  if (route === 'GET /bootstrap') return send(res, 200, bootstrap(user));

  if (route === 'POST /upload') {
    const name = S(url.searchParams.get('name'), 120);
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (!UPLOAD_EXT.has(ext)) throw fail(400, 'Цей тип файлу не підтримується (pdf, doc, docx, txt, зображення, аудіо, відео)');
    const body = await readBody(req, 60 * 1024 * 1024);
    if (!body.length) throw fail(400, 'Порожній файл');
    const fname = crypto.randomBytes(8).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(UP_DIR, fname), body);
    if (ghOn) ghEnqueue('uploads/' + fname, () => body);
    return send(res, 200, { url: '/files/' + fname, name });
  }

  if (route === 'POST /profile') {
    const b = await readJson(req);
    if (b.photoUrl !== undefined) user.photoUrl = /^\/files\/[a-f0-9]{16}\.(png|jpe?g|gif|webp)$/.test(b.photoUrl) ? b.photoUrl : '';
    if (b.name && S(b.name, 60).length >= 2) {
      const n = S(b.name, 60);
      if (db.users.some((u) => u.id !== user.id && u.name.toLowerCase() === n.toLowerCase())) throw fail(400, 'Таке імʼя вже є');
      user.name = n;
    }
    if (b.classId && user.role === 'student' && findClass(b.classId)) user.classId = b.classId;
    if (b.password) { if (S(b.password, 100).length < 4) throw fail(400, 'Пароль від 4 символів'); user.pw = hashPw(S(b.password, 100)); }
    save(); return send(res, 200, { ok: true });
  }

  // ---------- учень ----------
  if (route === 'POST /submit') {
    need(user, 'student');
    const b = await readJson(req);
    const hw = db.homework.find((h) => h.id === b.hwId && h.classId === user.classId);
    if (!hw) throw fail(404, 'Завдання не знайдено');
    let s = db.submissions.find((x) => x.hwId === hw.id && x.userId === user.id);
    if (!s) { s = { id: uid(), hwId: hw.id, userId: user.id, textGrade: null, audioGrade: null, comment: '', quiz: null }; db.submissions.push(s); }
    s.text = S(b.text, 20000);
    s.docLink = safeUrl(b.docLink);
    s.files = (Array.isArray(b.files) ? b.files : []).slice(0, 10).map((f) => ({ name: S(f.name, 120), url: safeUrl(f.url) })).filter((f) => f.url.startsWith('/files/'));
    s.vocab = (Array.isArray(b.vocab) ? b.vocab : []).slice(0, 60).map((v) => ({ word: S(v.word, 80), url: safeUrl(v.url) })).filter((v) => v.url.startsWith('/files/'));
    if (!s.quiz && hw.quiz && hw.quiz.length && Array.isArray(b.answers)) {
      const answers = hw.quiz.map((_, i) => (Number.isInteger(b.answers[i]) ? b.answers[i] : -1));
      const right = hw.quiz.filter((q, i) => answers[i] === q.correct).length;
      s.quiz = { answers, score: Math.round((right / hw.quiz.length) * 100) };
    }
    s.submittedAt = Date.now();
    save(); return send(res, 200, { ok: true });
  }

  // ---------- вчитель ----------
  if (route === 'POST /links') {
    if (user.role !== 'teacher' && !db.settings.studentLinks) throw fail(403, 'Недостатньо прав');
    const b = await readJson(req);
    const l = { id: b.id || uid(), title: S(b.title, 40), url: safeUrl(b.url), icon: S(b.icon, 20) || 'link', iconUrl: /^\/files\//.test(b.iconUrl || '') ? b.iconUrl : '' };
    const i = db.links.findIndex((x) => x.id === l.id);
    if (user.role !== 'teacher' && i >= 0 && db.links[i].by !== user.id) throw fail(403, 'Учень може змінювати лише свої посилання');
    if (i >= 0) { if (db.links[i].by) l.by = db.links[i].by; db.links[i] = l; } else { if (user.role !== 'teacher') l.by = user.id; db.links.push(l); }
    save(); return send(res, 200, { ok: true });
  }
  if ((m = /^DELETE \/links\/(\w+)$/.exec(route))) {
    if (user.role !== 'teacher' && !db.settings.studentLinks) throw fail(403, 'Недостатньо прав');
    db.links = db.links.filter((l) => !(l.id === m[1] && (user.role === 'teacher' || l.by === user.id))); save(); return send(res, 200, { ok: true }); }

  need(user, 'teacher');

  if (route === 'POST /classes') {
    const b = await readJson(req);
    const name = S(b.name, 60); if (!name) throw fail(400, 'Введіть назву');
    db.classes.push({ id: uid(), name, kind: b.kind === 'individual' ? 'individual' : 'group' });
    save(); return send(res, 200, { ok: true });
  }
  if ((m = /^DELETE \/classes\/(\w+)$/.exec(route))) {
    db.classes = db.classes.filter((c) => c.id !== m[1]);
    db.lessons = db.lessons.filter((l) => l.classId !== m[1]);
    db.homework = db.homework.filter((h) => h.classId !== m[1]);
    db.users.forEach((u) => { if (u.classId === m[1]) u.classId = null; });
    save(); return send(res, 200, { ok: true });
  }

  if (route === 'POST /settings') {
    const b = await readJson(req);
    db.settings.studentLinks = !!b.studentLinks; save(); return send(res, 200, { ok: true });
  }
  if (route === 'POST /topics') {
    const b = await readJson(req);
    db.topics = (Array.isArray(b.topics) ? b.topics : []).map((t) => S(t, 100)).filter(Boolean).slice(0, 60);
    save(); return send(res, 200, { ok: true });
  }

  if (route === 'POST /lessons') {
    const b = await readJson(req);
    if (!findClass(b.classId)) throw fail(400, 'Оберіть групу');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) throw fail(400, 'Некоректна дата');
    const l = {
      id: b.id || uid(), classId: b.classId, date: b.date, time: /^\d{2}:\d{2}$/.test(b.time || '') ? b.time : '',
      topic: S(b.topic, 120), title: S(b.title, 120), notes: S(b.notes, 30000),
      materials: (Array.isArray(b.materials) ? b.materials : []).slice(0, 40).map((x) => ({
        id: x.id || uid(), type: ['link', 'image', 'video', 'audio', 'file', 'youtube'].includes(x.type) ? x.type : 'link',
        title: S(x.title, 120), url: safeUrl(x.url) })).filter((x) => x.url),
    };
    const i = db.lessons.findIndex((x) => x.id === l.id);
    if (i >= 0) db.lessons[i] = l; else db.lessons.push(l);
    save(); return send(res, 200, { ok: true, id: l.id });
  }
  if ((m = /^DELETE \/lessons\/(\w+)$/.exec(route))) {
    db.lessons = db.lessons.filter((l) => l.id !== m[1]);
    db.homework.forEach((h) => { if (h.lessonId === m[1]) h.lessonId = ''; });
    save(); return send(res, 200, { ok: true });
  }

  if (route === 'POST /homework') {
    const b = await readJson(req);
    if (!findClass(b.classId)) throw fail(400, 'Оберіть групу');
    if (!S(b.title)) throw fail(400, 'Введіть назву завдання');
    const old = db.homework.find((h) => h.id === b.id);
    const h = {
      id: b.id || uid(), classId: b.classId, lessonId: S(b.lessonId, 20), topic: S(b.topic, 120), title: S(b.title, 140),
      description: S(b.description, 20000), due: /^\d{4}-\d{2}-\d{2}$/.test(b.due || '') ? b.due : '',
      vocab: (Array.isArray(b.vocab) ? b.vocab : []).slice(0, 60).map((v) => ({ word: S(v.word, 80), tr: S(v.tr, 120), audio: /^\/files\/[a-f0-9]{16}\.\w{2,4}$/.test(v.audio || '') ? v.audio : '' })).filter((v) => v.word),
      quiz: (Array.isArray(b.quiz) ? b.quiz : []).slice(0, 40).map((q) => ({
        q: S(q.q, 300), options: (Array.isArray(q.options) ? q.options : []).slice(0, 6).map((o) => S(o, 200)).filter(Boolean),
        correct: Math.max(0, parseInt(q.correct, 10) || 0) })).filter((q) => q.q && q.options.length >= 2 && q.correct < q.options.length),
      createdAt: old ? old.createdAt : Date.now(),
    };
    const i = db.homework.findIndex((x) => x.id === h.id);
    if (i >= 0) db.homework[i] = h; else db.homework.push(h);
    save(); return send(res, 200, { ok: true, id: h.id });
  }
  if ((m = /^DELETE \/homework\/(\w+)$/.exec(route))) {
    db.homework = db.homework.filter((h) => h.id !== m[1]);
    db.submissions = db.submissions.filter((s) => s.hwId !== m[1]);
    save(); return send(res, 200, { ok: true });
  }

  if (route === 'POST /grade') {
    const b = await readJson(req);
    const s = db.submissions.find((x) => x.hwId === b.hwId && x.userId === b.userId);
    if (!s) throw fail(404, 'Роботу не знайдено');
    s.textGrade = num(b.textGrade); s.audioGrade = num(b.audioGrade); s.comment = S(b.comment, 2000); s.gradedAt = Date.now();
    save(); return send(res, 200, { ok: true });
  }

  if ((m = /^POST \/users\/(\w+)\/password$/.exec(route))) {
    const b = await readJson(req); const u = db.users.find((x) => x.id === m[1] && x.role === 'student');
    if (!u || S(b.password, 100).length < 4) throw fail(400, 'Пароль від 4 символів');
    u.pw = hashPw(S(b.password, 100)); save(); return send(res, 200, { ok: true });
  }
  if ((m = /^POST \/users\/(\w+)\/class$/.exec(route))) {
    const b = await readJson(req); const u = db.users.find((x) => x.id === m[1] && x.role === 'student');
    if (!u) throw fail(404, 'Учня не знайдено');
    if (b.classId && !findClass(b.classId)) throw fail(400, 'Групу не знайдено');
    u.classId = b.classId || null; save(); return send(res, 200, { ok: true });
  }
  if ((m = /^POST \/lessons\/(\w+)\/move$/.exec(route))) {
    const b = await readJson(req); const l = db.lessons.find((x) => x.id === m[1]);
    if (!l) throw fail(404, 'Урок не знайдено');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) throw fail(400, 'Некоректна дата');
    l.date = b.date; save(); return send(res, 200, { ok: true });
  }
  if ((m = /^DELETE \/users\/(\w+)$/.exec(route))) {
    db.users = db.users.filter((u) => !(u.id === m[1] && u.role === 'student'));
    db.submissions = db.submissions.filter((s) => s.userId !== m[1]);
    save(); return send(res, 200, { ok: true });
  }

  throw fail(404, 'Не знайдено');
}

function serveFile(req, res, file, { cache = false, upload = false } = {}) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file).slice(1).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const h = { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes',
      'Cache-Control': cache ? 'private, max-age=86400' : 'no-cache' };
    if (upload && !/^(image|audio|video)\//.test(type) && ext !== 'pdf') h['Content-Disposition'] = 'attachment';
    const r = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (r && (r[1] || r[2])) {
      let start = r[1] ? +r[1] : Math.max(0, st.size - +r[2]);
      let end = r[1] && r[2] ? Math.min(+r[2], st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { ...h, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...h, 'Content-Length': st.size });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname.startsWith('/files/')) {
      if (!getUser(req)) { res.writeHead(401); return res.end('Увійдіть на сайт'); }
      const name = url.pathname.slice(7);
      if (!/^[a-f0-9]{16}\.[a-z0-9]{2,5}$/.test(name)) { res.writeHead(404); return res.end(); }
      const fp = path.join(UP_DIR, name);
      if (!fs.existsSync(fp) && ghOn) { try { const b = await ghGetRaw('uploads/' + name); if (b) fs.writeFileSync(fp, b); } catch (e) { console.error('GitHub read:', e.message); } }
      return serveFile(req, res, fp, { cache: true, upload: true });
    }
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    const file = path.normalize(path.join(PUBLIC, p));
    if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
    serveFile(req, res, file);
  } catch (e) {
    if (res.headersSent) return res.end();
    send(res, e.status || 500, { error: e.status ? e.message : 'Помилка сервера' });
    if (!e.status) console.error(e);
  }
});
(async () => {
  if (ghOn && !fs.existsSync(DB_FILE)) {
    try { const b = await ghGetRaw('db.json'); if (b) { fs.writeFileSync(DB_FILE, b); loadDb(); console.log('Дані відновлено з GitHub'); } } catch (e) { console.error('GitHub restore:', e.message); }
  }
  server.listen(PORT, () => console.log(`Cat teacher працює: http://localhost:${PORT}${ghOn ? ' (збереження в GitHub увімкнено)' : ''}`));
})();
