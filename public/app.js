'use strict';
/* Школа англійської мови Cat teacher — клієнт (без залежностей) */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SCHOOL = 'Школа англійської мови Cat teacher';

const ICONS = {
  zoom: '<rect x="3" y="6" width="12" height="12" rx="3"/><path d="M15 10.5l6-3.5v10l-6-3.5z"/>',
  pdf: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
  books: '<path d="M3.5 4h5v16h-5zM8.5 7h5v13h-5z"/><path d="M14.5 9.5l4.6-1.4 3 11-4.6 1.4z"/>',
  game: '<rect x="2" y="7" width="20" height="11" rx="5.5"/><path d="M7 10v5M4.5 12.5h5"/><circle cx="16" cy="11.5" r="1"/><circle cx="18.6" cy="14" r="1"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  edit: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
};
const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ICONS.link}</svg>`;

let ST = null;       // дані користувача
let STATUS = null;   // стан до входу
const isT = () => ST?.me.role === 'teacher';

/* ---------- утиліти ---------- */
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const fmt = (d) => (d ? new Date(d + 'T00:00').toLocaleDateString(LOC(), { day: 'numeric', month: 'short' }) : '');
const fmtLong = (d) => new Date(d + 'T00:00').toLocaleDateString(LOC(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const safeUrl = (u) => (/^(https?:\/\/|\/files\/)/i.test(u || '') ? u : '');

async function api(path, method = 'GET', body) {
  const r = await fetch('/api' + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Помилка');
  return j;
}
async function upload(file) {
  const r = await fetch('/api/upload?name=' + encodeURIComponent(file.name || 'file'), { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Не вдалося завантажити');
  return j;
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200); }
async function run(btn, fn) {
  if (btn) btn.disabled = true;
  try { await fn(); } catch (e) { toast(e.message || 'Помилка'); } finally { if (btn) btn.disabled = false; }
}
async function load() { ST = await api('/bootstrap'); }
function modal(html) {
  const m = document.createElement('div');
  m.className = 'modal'; m.innerHTML = `<div role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { m.remove(); document.removeEventListener('keydown', esc_); };
  const esc_ = (e) => { if (e.key === 'Escape') close(); };
  m.addEventListener('mousedown', (e) => { if (e.target === m) close(); });
  document.addEventListener('keydown', esc_);
  document.body.append(m); m.close = close;
  $$('[data-close]', m).forEach((b) => b.addEventListener('click', close));
  return m;
}

function inl(s) { return s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
function md(t) {
  let out = '', list = false;
  for (const l of esc(t).split('\n')) {
    if (/^\s*[-•]\s+/.test(l)) { if (!list) { out += '<ul>'; list = true; } out += '<li>' + inl(l.replace(/^\s*[-•]\s+/, '')) + '</li>'; continue; }
    if (list) { out += '</ul>'; list = false; }
    if (/^#{1,3}\s/.test(l)) out += '<h4>' + inl(l.replace(/^#+\s/, '')) + '</h4>';
    else if (l.trim()) out += '<p>' + inl(l) + '</p>';
  }
  return out + (list ? '</ul>' : '');
}
const photo = (url, cls = 'photo') => (url ? `<img class="${cls}" src="${esc(url)}" alt="">` : `<span class="${cls} ph" aria-hidden="true"></span>`);
const cls = (id) => ST.classes.find((c) => c.id === id);
const usr = (id) => ST.users.find((u) => u.id === id);

/* ---------- оцінки: тест + оцінена робота, середнє за темою, середнє за всі теми ---------- */
function topicScores(userId) {
  const by = {};
  for (const s of ST.submissions.filter((x) => x.userId === userId)) {
    const hw = ST.homework.find((h) => h.id === s.hwId); if (!hw) continue;
    const parts = [];
    if (s.quiz) parts.push(s.quiz.score);
    if (s.textGrade != null) parts.push(s.textGrade);
    if (s.audioGrade != null) parts.push(s.audioGrade);
    if (parts.length) (by[hw.topic || 'Без теми'] ??= []).push(...parts);
  }
  return Object.entries(by).map(([topic, a]) => ({ topic, score: Math.round(a.reduce((x, y) => x + y, 0) / a.length) }));
}
function avg(userId) { const t = topicScores(userId); return t.length ? Math.round(t.reduce((a, b) => a + b.score, 0) / t.length) : null; }

/* ---------- каркас ---------- */
function logo() { return `<a class="logo" href="#/" aria-label="Cat teacher"><b>Cat</b><i>teacher</i><img src="/img/cat.png" alt=""></a>`; }
function shell(inner, active = '') {
  const me = ST.me;
  const nav = [['#/', 'Головна', 'home'], ...(isT() ? [['#/journal', 'Журнал', 'journal']] : []), ['#/calendar', 'Календар', 'cal'],
    ...(isT() ? [] : [['#/student/' + me.id, 'Мій кабінет', 'me']]), ['#/profile', 'Профіль', 'profile']]
    .map(([h, t, k]) => `<a class="pill sm ${active === k ? 'on' : ''}" href="${h}">${t}</a>`).join('');
  $('#app').innerHTML = `<div class="wrap"><div class="top"><div><a class="pill" href="#/">${SCHOOL}</a>
    <nav class="nav">${nav}<span class="me">${me.photoUrl ? `<img class="avatar" src="${esc(me.photoUrl)}" alt="">` : ''}${esc(me.name)}
    <button class="pill sm" data-act="lang" aria-label="Language">${LANG === 'uk' ? 'EN' : 'UA'}</button><button class="pill sm" data-act="logout">Вийти</button></span></nav></div>${logo()}</div>${inner}</div>`;
  window.scrollTo(0, 0);
}
const back = (href, t) => `<p><a href="${href}">← ${t}</a></p>`;

/* ---------- заставка ---------- */
function splash() {
  return new Promise((resolve) => {
    let seen = false; try { seen = sessionStorage.getItem('splash'); sessionStorage.setItem('splash', '1'); } catch {}
    if (seen) return resolve();
    const s = $('#splash'); s.hidden = false;
    s.innerHTML = `<svg viewBox="0 0 800 470" role="img" aria-label="${SCHOOL}">
      <defs><path id="arc" d="M 50 330 A 350 300 0 0 1 750 330" fill="none"/></defs>
      <text class="arc-text"><textPath href="#arc" startOffset="50%" text-anchor="middle">${SCHOOL}
        <animate attributeName="startOffset" from="-30%" to="50%" dur="1.9s" begin="0.2s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".2 .8 .2 1"/></textPath></text>
      <g class="cat" style="animation-delay:.15s">
        <image href="/img/cat.png" x="290" y="268" width="220"/>
        <text class="brand-c" x="352" y="322" text-anchor="end">Cat</text>
        <text class="brand-t" x="436" y="306" transform="rotate(14 436 306)">teacher</text></g></svg>`;
    const done = () => { s.classList.add('out'); setTimeout(() => { s.hidden = true; resolve(); }, 500); };
    s.onclick = done; setTimeout(done, 3200);
  });
}

/* ---------- вхід / реєстрація ---------- */
let authModeNow = 'login';
function authScreen(mode = 'login') {
  const setup = STATUS.setup;
  if (setup) mode = 'setup';
  const groups = STATUS.classes.filter((c) => c.kind === 'group'), ind = STATUS.classes.filter((c) => c.kind === 'individual');
  const pick = (list, title) => list.length ? `<div class="grp">${title}</div>` + list.map((c) => `<label class="opt"><input type="radio" name="classId" value="${c.id}" required> ${esc(c.name)}</label>`).join('') : '';
  authModeNow = mode;
  $('#app').innerHTML = `<div class="auth"><div class="auth-card"><button class="pill sm" data-act="lang" aria-label="Language" style="justify-self:end">${LANG === 'uk' ? 'EN' : 'UA'}</button>${logo()}<div class="pill">${SCHOOL}</div>
    ${setup ? '<p class="hint" style="text-align:center">Перший запуск. Створіть акаунт вчителя.</p>' : `<div class="seg"><button class="${mode === 'login' ? 'on' : ''}" data-act="authmode" data-m="login">Вхід</button><button class="${mode === 'register' ? 'on' : ''}" data-act="authmode" data-m="register">Реєстрація учня</button></div>`}
    <form class="f" data-form="${mode}">
      <label for="a-name">${setup ? 'Ваше імʼя' : 'Імʼя та прізвище'}<input id="a-name" type="text" name="name" autocomplete="username" required></label>
      <label for="a-pw">Пароль<input id="a-pw" type="password" name="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required minlength="${setup ? 6 : 4}"></label>
      ${setup && STATUS.needCode ? `<label for="a-code">Код запуску<span class="h">Той, що ви задали в налаштуваннях хостингу (SETUP_CODE)</span><input id="a-code" type="password" name="code" required></label>` : ''}
      ${mode === 'register' ? `<div class="classpick"><b>Оберіть свою групу</b>${pick(groups, 'ГРУПИ')}${pick(ind, 'ІНДИВІДУАЛЬНІ')}</div>` : ''}
      <div class="err" id="a-err"></div>
      <button class="btn" type="submit">${setup ? 'Створити акаунт вчителя' : mode === 'login' ? 'Увійти' : 'Зареєструватися'}</button>
    </form></div></div>`;
}

/* ---------- панелі ---------- */
function lessonRow(l) { return `<a class="row" href="#/lesson/${l.id}"><span class="t">${esc(l.topic || l.title || 'Урок')}</span><span class="d">${fmt(l.date)}${l.time ? ' ' + l.time : ''}</span></a>`; }
function panel(title, body, add = '') { return `<section class="panel"><div class="tab">${title}${add}</div><div class="box">${body}</div></section>`; }

function lessonPanels(classId, userId) {
  const t = today(), L = ST.lessons.filter((l) => l.classId === classId);
  const past = L.filter((l) => l.date < t).sort((a, b) => b.date.localeCompare(a.date));
  const next = L.filter((l) => l.date >= t).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const H = ST.homework.filter((h) => h.classId === classId).sort((a, b) => b.createdAt - a.createdAt);
  const nStud = ST.users.filter((u) => u.classId === classId).length;
  const hwRows = H.map((h) => {
    if (isT()) {
      const n = ST.submissions.filter((s) => s.hwId === h.id).length;
      return `<a class="row" href="#/review/${h.id}"><span class="t">${esc(h.title)}</span><span class="badge">${n}/${nStud}</span></a>`;
    }
    const s = ST.submissions.find((x) => x.hwId === h.id && x.userId === userId);
    const b = !s ? `<span class="badge todo">${h.due ? L('до ', 'due ') + fmt(h.due) : 'нове'}</span>` : (s.textGrade != null || s.audioGrade != null) ? '<span class="badge ok">оцінено</span>' : '<span class="badge ok">здано</span>';
    return `<a class="row" href="#/hw/${h.id}"><span class="t">${esc(h.title)}</span>${b}</a>`;
  }).join('');
  const addHw = isT() ? `<a class="pill sm add" href="#/hw-edit/new?class=${classId}" title="Нове завдання">${ic('plus')}</a>` : '';
  return `<div class="grid3">
    ${panel('Пройдений матеріал', past.map(lessonRow).join('') || '<div class="empty">Поки порожньо</div>')}
    ${panel('завдане д\\з', hwRows || '<div class="empty">Завдань немає</div>', addHw)}
    ${panel('наступні уроки', next.map(lessonRow).join('') || '<div class="empty">Уроки ще не заплановано</div>')}</div>`;
}

/* ---------- головна ---------- */
function linksPanel() {
  const tiles = ST.links.map((l) => {
    const inner = `<span class="ic">${l.iconUrl ? `<img src="${esc(l.iconUrl)}" alt="">` : ic(l.icon)}</span><span>${esc(l.title)}</span>`;
    const ed = (isT() || (ST.settings?.studentLinks && l.by === ST.me.id)) ? `<button class="pill sm ed" data-act="editlink" data-id="${l.id}" aria-label="${L('Змінити', 'Edit')} ${esc(l.title)}">${ic('edit')}</button>` : '';
    const url = safeUrl(l.url);
    return url ? `<div style="position:relative"><a class="lnk" href="${esc(url)}" target="_blank" rel="noopener">${inner}</a>${ed}</div>`
      : `<div style="position:relative"><div class="lnk off" title="Посилання ще не додано">${inner}</div>${ed}</div>`;
  }).join('');
  const toggle = isT() ? `<label class="opt" style="font-size:15px"><input type="checkbox" id="linkstoggle" ${ST.settings?.studentLinks ? 'checked' : ''}> Учні можуть додавати власні посилання</label>` : '';
  return panel('корисні посилання', `<div class="links">${tiles || '<div class="empty">Немає посилань</div>'}</div>${toggle}`,
    (isT() || ST.settings?.studentLinks) ? `<button class="pill sm add" data-act="editlink" data-id="" title="Додати">${ic('plus')}</button>` : '');
}
function vHome() {
  if (isT()) {
    const rowsFor = (k) => ST.classes.filter((c) => c.kind === k).map((c) => {
      const n = ST.users.filter((u) => u.classId === c.id).length;
      return `<div style="display:flex;align-items:center"><a class="row" style="flex:1" href="#/class/${c.id}"><span class="t">${esc(c.name)}</span><span class="d">${L(n + ' уч.', n + (n === 1 ? ' student' : ' students'))}</span></a><button class="row x" data-act="delclass" data-id="${c.id}" aria-label="${L('Видалити', 'Delete')} ${esc(c.name)}">${ic('x')}</button></div>`;
    }).join('') || '<div class="empty">Додайте перший запис кнопкою +</div>';
    const unassigned = ST.users.filter((u) => !cls(u.classId));
    shell(`<div class="grid3">
      ${panel('групи', rowsFor('group'), `<button class="pill sm add" data-act="addclass" data-kind="group" title="Додати групу">${ic('plus')}</button>`)}
      ${panel('індивідуальні', rowsFor('individual'), `<button class="pill sm add" data-act="addclass" data-kind="individual" title="Додати">${ic('plus')}</button>`)}
      ${linksPanel()}</div>
      ${unassigned.length ? `<div class="card"><h3>Учні без групи</h3>${unassigned.map((u) => `<a class="row" href="#/student/${u.id}"><span class="t">${esc(u.name)}</span></a>`).join('')}</div>` : ''}`, 'home');
    return;
  }
  const c = cls(ST.me.classId), t = ST.teacher;
  shell(`<div class="grid3">
    ${panel('моя група', c ? `<a class="row" href="#/student/${ST.me.id}"><span class="t">${esc(c.name)}</span><span class="d">відкрити →</span></a>` : '<div class="empty">Групу не обрано. Оберіть у профілі.</div>')}
    ${panel('ваш вчитель', `<div class="teacher-card">${photo(t?.photoUrl, 'photo')}<div><b>${esc(t?.name || '')}</b><div class="hint">Cat teacher</div></div></div>`)}
    ${linksPanel()}</div>`, 'home');
}

/* ---------- група ---------- */
function vClass(id) {
  const c = cls(id); if (!c) return vHome();
  const studs = ST.users.filter((u) => u.classId === id);
  shell(`${back('#/', 'Всі групи')}<div class="head"><div class="head-l"><span class="pill big">${esc(c.name)}</span>
      <div class="actions"><a class="btn" href="#/hw-edit/new?class=${id}">${ic('plus')} Нове д/з</a><a class="btn ghost" href="#/calendar?class=${id}">Додати урок у календарі</a><a class="btn ghost" href="#/journal">Журнал</a></div></div>
      <div class="head-r"><a class="calbtn" href="#/calendar?class=${id}"><span>календар<br>занять</span><img src="/img/calendar.png" alt=""></a></div></div>
    ${lessonPanels(id)}
    <div class="card"><h3>${L('Учні', 'Students')} (${studs.length})</h3>${studs.map((u) => { const a = avg(u.id); return `<a class="row" style="align-items:center" href="#/student/${u.id}"><span class="t" style="display:flex;gap:10px;align-items:center">${photo(u.photoUrl, 'avatar')} ${esc(u.name)}</span><span class="d">${a == null ? 'ще без оцінок' : a + '%'}</span></a>`; }).join('') || '<div class="empty">У групі ще немає учнів. Учні обирають групу під час реєстрації.</div>'}</div>`, 'home');
}

/* ---------- сторінка учня ---------- */
function vStudent(id) {
  const u = usr(id); if (!u) return vHome();
  const c = cls(u.classId), a = avg(u.id), ts = topicScores(u.id);
  const ctrl = isT() ? `<div class="actions"><button class="btn ghost" data-act="resetpw" data-id="${u.id}">Новий пароль</button><button class="btn danger" data-act="deluser" data-id="${u.id}">Видалити учня</button></div>` : '';
  shell(`${isT() && c ? back('#/class/' + c.id, c.name) : ''}<div class="head"><div class="head-l"><span class="pill name">${esc(u.name)}</span>
      <span class="pill big">${c ? esc(c.name) : 'Без групи'}</span>${ctrl}</div>
      <div class="head-r">${photo(u.photoUrl)}<div class="score"><b>${a == null ? '—' : a + ' %'}</b><small>середня оцінка</small></div>
      <a class="calbtn" href="#/calendar${c ? '?class=' + c.id : ''}"><span>календар<br>занять</span><img src="/img/calendar.png" alt=""></a></div></div>
    ${c ? lessonPanels(c.id, u.id) : '<div class="card">Учня не прикріплено до групи.</div>'}
    <div class="topics card"><h3>Оцінки за темами</h3>${ts.map((t) => `<div class="bar"><span>${esc(t.topic)}</span><span class="track"><span class="fill" style="display:block;width:${t.score}%"></span></span><span class="v">${t.score}%</span></div>`).join('') || '<p class="hint">Оцінки зʼявляться після першого тесту або перевіреної роботи. Середнє за темою рахується з результатів тестів і оцінок вчителя.</p>'}</div>`, isT() ? 'home' : 'me');
}

/* ---------- календар ---------- */
let cal = { y: new Date().getFullYear(), m: new Date().getMonth() };
function vCalendar(q) {
  let filter = q.get('class') || (isT() ? '' : ST.me.classId || '');
  if (q.get('ym')) { const [y, m] = q.get('ym').split('-').map(Number); cal = { y, m: m - 1 }; }
  const first = new Date(cal.y, cal.m, 1), off = (first.getDay() + 6) % 7, days = new Date(cal.y, cal.m + 1, 0).getDate();
  const total = Math.ceil((off + days) / 7) * 7, t = today();
  const prev = new Date(cal.y, cal.m - 1, 1), nxt = new Date(cal.y, cal.m + 1, 1);
  const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const link = (d) => `#/calendar?ym=${ym(d)}${filter ? '&class=' + filter : ''}`;
  let cells = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((d) => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < total; i++) {
    const d = new Date(cal.y, cal.m, 1 - off + i), key = iso(d);
    const ls = ST.lessons.filter((l) => l.date === key && (!filter || l.classId === filter)).sort((a, b) => a.time.localeCompare(b.time));
    cells += `<div class="day ${d.getMonth() !== cal.m ? 'out' : ''} ${key === t ? 'today' : ''}" data-act="${isT() ? 'newlesson' : ''}" data-date="${key}" ${isT() ? 'data-drop-date="' + key + '"' : ''} ${isT() ? 'tabindex="0" role="button" aria-label="' + L('Створити урок', 'Create lesson') + ' ' + fmt(key) + '"' : ''}>
      <span class="n">${d.getDate()}</span>${ls.map((l) => `<a class="chip ${key < t ? 'past' : ''}" href="#/lesson/${l.id}" ${isT() ? 'draggable="true" data-drag-l="' + l.id + '"' : ''} title="${esc(l.topic)}">${l.time ? l.time + ' ' : ''}${esc(l.topic || l.title || 'Урок')}${!filter ? ` <small>${esc(cls(l.classId)?.name || '')}</small>` : ''}</a>`).join('')}</div>`;
  }
  const sel = isT() ? `<select id="calfilter" aria-label="Група" style="width:auto"><option value="">Усі групи</option>${ST.classes.map((c) => `<option value="${c.id}" ${c.id === filter ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : '';
  shell(`<div class="calhead"><a class="pill sm" href="${link(prev)}" aria-label="Попередній місяць">←</a><h2>${first.toLocaleDateString(LOC(), { month: 'long', year: 'numeric' })}</h2>
    <a class="pill sm" href="${link(nxt)}" aria-label="Наступний місяць">→</a><a class="pill sm" href="#/calendar${filter ? '?class=' + filter : ''}" onclick="cal={y:new Date().getFullYear(),m:new Date().getMonth()}">Сьогодні</a>${sel}</div>
    ${isT() ? '<p class="hint">Натисніть на дату, щоб створити урок. Щоб змінити дату, перетягніть урок на інший день.</p>' : ''}<div class="cal">${cells}</div>`, 'cal');
  const f = $('#calfilter'); if (f) f.onchange = () => { location.hash = `#/calendar?ym=${cal.y}-${pad(cal.m + 1)}${f.value ? '&class=' + f.value : ''}`; };
}
function newLessonModal(date, preClass) {
  const m = modal(`<h3>${L('Новий урок', 'New lesson')} · ${fmtLong(date)}</h3><form class="f" data-form="newlesson">
    <input type="hidden" name="date" value="${date}">
    <label for="nl-c">Група<select id="nl-c" name="classId" required>${ST.classes.map((c) => `<option value="${c.id}" ${c.id === preClass ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    <div class="two"><label for="nl-t">Час<input id="nl-t" type="time" name="time"></label><label for="nl-ti">Тема<input id="nl-ti" type="text" name="topic" list="topics" required></label></div>
    <datalist id="topics">${ST.topics.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
    <div class="actions"><button class="btn" type="submit">Створити урок</button><button class="btn ghost" type="button" data-close>Скасувати</button></div></form>`);
  $('input[name=topic]', m).focus();
}

/* ---------- урок ---------- */
function detect(url, name = '') {
  const s = (name || url).toLowerCase().split('?')[0];
  if (/(youtube\.com|youtu\.be)/i.test(url)) return 'youtube';
  if (/\.(png|jpe?g|gif|webp)$/.test(s)) return 'image';
  if (/\.(mp4|mov|webm)$/.test(s)) return 'video';
  if (/\.(mp3|m4a|wav|ogg)$/.test(s)) return 'audio';
  if (/\.(pdf|docx?|txt)$/.test(s)) return 'file';
  return 'link';
}
function matHtml(m) {
  const u = esc(safeUrl(m.url)), cap = `<div class="cap"><span>${esc(m.title || m.url)}</span></div>`;
  if (m.type === 'image') return `<div class="mat"><a href="${u}" target="_blank" rel="noopener"><img class="m" src="${u}" alt="${esc(m.title)}"></a>${cap}</div>`;
  if (m.type === 'video') return `<div class="mat"><video controls preload="metadata" src="${u}"></video>${cap}</div>`;
  if (m.type === 'audio') return `<div class="mat">${cap}<audio controls preload="none" src="${u}"></audio></div>`;
  if (m.type === 'youtube') {
    const id = (/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/.exec(m.url) || [])[1];
    return id ? `<div class="mat"><iframe src="https://www.youtube-nocookie.com/embed/${id}" allowfullscreen loading="lazy" title="${esc(m.title)}"></iframe>${cap}</div>` : `<div class="mat"><a class="open" href="${u}" target="_blank" rel="noopener">${ic('link')}<b>${esc(m.title || m.url)}</b></a></div>`;
  }
  return `<div class="mat"><a class="open" href="${u}" target="_blank" rel="noopener">${ic(m.type === 'file' ? 'pdf' : 'link')}<b>${esc(m.title || m.url)}</b></a></div>`;
}
let editMats = [];
function vLesson(id, q) {
  const l = ST.lessons.find((x) => x.id === id); if (!l) return vHome();
  const c = cls(l.classId), hws = ST.homework.filter((h) => h.lessonId === id);
  if (isT() && q.get('edit')) return vLessonEdit(l);
  const hwList = hws.map((h) => `<a class="row" href="#/${isT() ? 'review' : 'hw'}/${h.id}"><span class="t">${esc(h.title)}</span></a>`).join('');
  shell(`${back('#/calendar?class=' + l.classId, 'Календар')}<div class="head"><div class="head-l"><span class="pill big" style="font-size:clamp(18px,3vw,28px)">${esc(l.topic || l.title || 'Урок')}</span>
    <div class="actions"><span class="pill sm">${esc(c?.name || '')}</span><span class="pill sm">${fmtLong(l.date)}${l.time ? ', ' + l.time : ''}</span></div>
    ${isT() ? `<div class="actions"><a class="btn" href="#/lesson/${id}?edit=1">${ic('edit')} Редагувати</a><a class="btn ghost" href="#/hw-edit/new?class=${l.classId}&lesson=${id}">${ic('plus')} Домашнє завдання</a><button class="btn danger" data-act="dellesson" data-id="${id}">Видалити</button></div>` : ''}</div></div>
    ${l.title ? `<h2 style="margin-top:18px;font-size:22px">${esc(l.title)}</h2>` : ''}
    <div class="card"><h3>Конспект</h3><div class="prose">${l.notes ? md(l.notes) : '<p class="hint">Конспект ще не додано.</p>'}</div></div>
    <div class="card"><h3>Матеріали</h3>${l.materials.length ? `<div class="mats">${l.materials.map(matHtml).join('')}</div>` : '<p class="hint">Матеріалів немає.</p>'}</div>
    ${hws.length ? `<div class="card"><h3>Домашнє завдання до уроку</h3>${hwList}</div>` : ''}`, 'cal');
}
function matEditRows() {
  return editMats.map((m, i) => `<div class="row" style="align-items:center"><span class="t">${esc(m.type)} · ${esc(m.title || m.url)}</span><button type="button" class="row x" data-act="delmat" data-i="${i}" aria-label="Прибрати">${ic('x')}</button></div>`).join('') || '<p class="hint">Додайте посилання, картинки, відео, PDF або аудіо.</p>';
}
function vLessonEdit(l) {
  editMats = l.materials.map((m) => ({ ...m }));
  shell(`${back('#/lesson/' + l.id, 'До уроку')}<h2 style="font-size:22px">Редагування уроку</h2><form class="f card" data-form="savelesson" data-id="${l.id}">
    <div class="two"><label for="le-c">Група<select id="le-c" name="classId">${ST.classes.map((c) => `<option value="${c.id}" ${c.id === l.classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    <div class="two"><label for="le-d">Дата<input id="le-d" type="date" name="date" value="${l.date}" required></label><label for="le-t">Час<input id="le-t" type="time" name="time" value="${l.time}"></label></div></div>
    <label for="le-ti">Тема<input id="le-ti" type="text" name="topic" value="${esc(l.topic)}" list="topics" required></label>
    <datalist id="topics">${ST.topics.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
    <label for="le-n">Назва уроку (необовʼязково)<input id="le-n" type="text" name="title" value="${esc(l.title)}"></label>
    <label for="le-no">Конспект<span class="h">Порожній рядок розділяє абзаци. «- » на початку рядка робить список, **текст** робить жирним, посилання стають клікабельними.</span><textarea id="le-no" name="notes" style="min-height:260px">${esc(l.notes)}</textarea></label>
    <div><b>Матеріали</b><div id="matlist">${matEditRows()}</div></div>
    <div class="two"><label for="m-url">Посилання (сайт, YouTube, Google Документ…)<input id="m-url" type="url" placeholder="https://"></label><label for="m-title">Назва посилання<span class="h">показується на картці матеріалу, можна залишити порожнім</span><input id="m-title" type="text"></label></div>
    <div class="actions"><button class="btn ghost" type="button" data-act="addmat">${ic('plus')} Додати посилання</button>
      <label class="btn ghost" for="m-file" style="cursor:pointer">${ic('plus')} Завантажити файл</label><input id="m-file" type="file" multiple hidden accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"></div>
    <div class="err" id="f-err"></div><div class="actions"><button class="btn" type="submit">Зберегти</button><a class="btn ghost" href="#/lesson/${l.id}">Скасувати</a></div></form>`, 'cal');
  $('#m-file').onchange = async (e) => {
    for (const f of e.target.files) { try { toast(L('Завантажую ', 'Uploading ') + f.name + '…'); const r = await upload(f); editMats.push({ id: '', type: detect(r.url, f.name), title: f.name, url: r.url }); $('#matlist').innerHTML = matEditRows(); } catch (er) { toast(er.message); } }
    e.target.value = '';
  };
}

/* ---------- створення/редагування д/з ---------- */
let qz = [];
function qzDraw() {
  $('#qz').innerHTML = qz.map((q, i) => `<div class="qb" data-i="${i}"><label for="qq${i}">${L('Питання', 'Question')} ${i + 1}<input id="qq${i}" type="text" class="qq" value="${esc(q.q)}"></label>
    ${[0, 1, 2, 3].map((j) => `<div class="o"><input type="radio" name="qc${i}" value="${j}" ${q.correct === j ? 'checked' : ''} aria-label="${L('Правильна відповідь', 'Correct answer')} ${j + 1}"><input type="text" class="qo" value="${esc(q.options[j] || '')}" placeholder="${L('Варіант', 'Option')} ${j + 1}" aria-label="${L('Варіант', 'Option')} ${j + 1}"></div>`).join('')}
    <button type="button" class="btn danger" style="justify-self:start" data-act="delq" data-i="${i}">Прибрати питання</button></div>`).join('') || '<p class="hint">Тест необовʼязковий. Позначте кружечком правильну відповідь.</p>';
}
function qzSync() {
  qz = $$('#qz .qb').map((b) => ({ q: $('.qq', b).value, options: $$('.qo', b).map((x) => x.value), correct: +(($('input[type=radio]:checked', b) || {}).value || 0) }));
}
let vEd = [];
function vSyncEd() { vEd = $$('#vlist .vw').map((r, i) => ({ word: $('.vwd', r).value, tr: $('.vtr', r).value, audio: vEd[i]?.audio || '' })); }
function vDrawEd() {
  $('#vlist').innerHTML = vEd.map((v, i) => `<div class="vw" data-i="${i}"><div class="vpair"><input class="vwd" type="text" value="${esc(v.word)}" placeholder="Слово" aria-label="Слово"><input class="vtr" type="text" value="${esc(v.tr)}" placeholder="Переклад" aria-label="Переклад"></div>
    <div class="ctl">${v.audio ? `<audio controls preload="none" src="${esc(v.audio)}"></audio>` : ''}${canRec ? `<button type="button" class="rec" data-act="vrec" data-i="${i}" aria-label="Записати зразок вимови" title="Записати зразок вимови">${ic('mic')}</button>` : `<input type="file" accept="audio/*" capture data-vefile="${i}" aria-label="Файл зі зразком вимови">`}
    <button type="button" class="row x" data-act="delv" data-i="${i}" aria-label="Прибрати слово">${ic('x')}</button></div></div>`).join('') || '<p class="hint">Слів немає. Вокабуляр необовʼязковий.</p>';
  $$('[data-vefile]').forEach((inp) => { inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { const r = await upload(f); vSyncEd(); vEd[+inp.dataset.vefile].audio = r.url; vDrawEd(); } catch (e) { toast(e.message); } }; });
}
function vHwEdit(id, q) {
  const h = id === 'new' ? { id: '', classId: q.get('class') || ST.classes[0]?.id, lessonId: q.get('lesson') || '', topic: '', title: '', description: '', due: '', vocab: [], quiz: [] } : ST.homework.find((x) => x.id === id);
  if (!h) return vHome();
  if (h.lessonId && !h.topic) h.topic = ST.lessons.find((l) => l.id === h.lessonId)?.topic || '';
  qz = (h.quiz || []).map((x) => ({ ...x, options: [...x.options] }));
  vEd = (h.vocab || []).map((v) => ({ word: v.word, tr: v.tr || '', audio: v.audio || '' }));
  const lessons = ST.lessons.filter((l) => l.classId === h.classId).sort((a, b) => b.date.localeCompare(a.date));
  shell(`${back(h.id ? '#/review/' + h.id : '#/class/' + h.classId, 'Назад')}<h2 style="font-size:22px">${h.id ? L('Редагування домашнього завдання', 'Edit homework') : L('Нове домашнє завдання', 'New homework')}</h2>
  <form class="f card" data-form="savehw" data-id="${h.id}">
    <div class="two"><label for="h-c">Група<select id="h-c" name="classId">${ST.classes.map((c) => `<option value="${c.id}" ${c.id === h.classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    <label for="h-l">Урок<select id="h-l" name="lessonId"><option value="">Без привʼязки</option>${lessons.map((l) => `<option value="${l.id}" ${l.id === h.lessonId ? 'selected' : ''}>${fmt(l.date)} · ${esc(l.topic)}</option>`).join('')}</select></label></div>
    <div class="two"><label for="h-t">Назва<input id="h-t" type="text" name="title" value="${esc(h.title)}" required></label>
    <label for="h-to">Тема (для середньої оцінки)<input id="h-to" type="text" name="topic" value="${esc(h.topic)}" list="topics"></label></div>
    <datalist id="topics">${ST.topics.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
    <label for="h-d">Завдання для учня<textarea id="h-d" name="description">${esc(h.description)}</textarea></label>
    <label for="h-due">Здати до<input id="h-due" type="date" name="due" value="${h.due}" style="max-width:220px"></label>
    <div><b>Вокабуляр для озвучення</b><div class="hint">Додайте слова. Можна записати власну вимову як зразок, учень почує її й запише свою.</div>
      <div id="vlist" class="vocab" style="margin-top:8px"></div><button type="button" class="btn ghost" style="margin-top:8px" data-act="addv">${ic('plus')} Додати слово</button></div>
    <div><b>Тест за пройденим матеріалом</b><div id="qz" style="margin-top:8px"></div><button type="button" class="btn ghost" data-act="addq">${ic('plus')} Додати питання</button></div>
    <div class="err" id="f-err"></div><div class="actions"><button class="btn" type="submit">Зберегти</button>${h.id ? `<button type="button" class="btn danger" data-act="delhw" data-id="${h.id}">Видалити завдання</button>` : ''}</div></form>`, 'home');
  qzDraw(); vDrawEd();
  $('#h-c').onchange = () => { const c = $('#h-c').value; const ls = ST.lessons.filter((l) => l.classId === c); $('#h-l').innerHTML = '<option value="">Без привʼязки</option>' + ls.map((l) => `<option value="${l.id}">${fmt(l.date)} · ${esc(l.topic)}</option>`).join(''); };
  $('#h-l').onchange = () => { const l = ST.lessons.find((x) => x.id === $('#h-l').value); if (l && !$('#h-to').value) $('#h-to').value = l.topic; };
}

/* ---------- д/з учня ---------- */
let draft = null, rec = null;
const canRec = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
function vocabDraw() {
  const h = draft.hw; if (!h.vocab.length) return;
  $('#vocab').innerHTML = h.vocab.map((v, i) => {
    const url = draft.vocab[v.word];
    return `<div class="vw"><div><div class="w">${esc(v.word)}</div>${v.tr ? `<div class="tr">${esc(v.tr)}</div>` : ''}</div><div class="ctl">
      ${v.audio ? `<span class="hint">Зразок</span><audio controls preload="none" src="${esc(v.audio)}"></audio>` : ''}
      ${url ? `<span class="hint">Ваш запис</span><audio controls preload="none" src="${esc(url)}"></audio>` : ''}
      ${canRec ? `<button type="button" class="rec" data-act="rec" data-i="${i}" aria-label="${url ? L('Записати ще раз', 'Record again') : L('Записати', 'Record')}: ${esc(v.word)}" title="${url ? L('Перезаписати', 'Re-record') : L('Записати', 'Record')}">${ic('mic')}</button>`
        : `<input type="file" accept="audio/*" capture data-vfile="${i}" aria-label="${L('Голос', 'Voice')}: ${esc(v.word)}">`}</div></div>`;
  }).join('');
  $$('[data-vfile]').forEach((inp) => { inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { const r = await upload(f); draft.vocab[h.vocab[inp.dataset.vfile].word] = r.url; vocabDraw(); } catch (e) { toast(e.message); } }; });
}
async function startRec(btn, onUrl) {
  if (rec) { if (rec.btn === btn) rec.mr.stop(); else toast('Спершу зупиніть поточний запис'); return; }
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return toast('Дозвольте доступ до мікрофона в налаштуваннях браузера'); }
  const mr = new MediaRecorder(stream), chunks = [];
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  mr.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop()); rec = null; btn.classList.remove('live'); btn.innerHTML = ic('mic');
    const type = mr.mimeType || 'audio/webm', ext = /mp4|aac/.test(type) ? 'm4a' : /ogg/.test(type) ? 'ogg' : 'webm';
    try { const r = await upload(new File([new Blob(chunks, { type })], 'voice.' + ext, { type })); onUrl(r.url); } catch (e) { toast(e.message); }
  };
  mr.start(); rec = { mr, btn }; btn.classList.add('live'); btn.innerHTML = ic('stop');
}
function toggleRec(btn) {
  const word = draft.hw.vocab[btn.dataset.i].word;
  return startRec(btn, (url) => { draft.vocab[word] = url; vocabDraw(); toast('Запис збережено. Не забудьте натиснути «Здати».'); });
}
function filesDraw() {
  $('#fl').innerHTML = draft.files.map((f, i) => `<li><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.name)}</a><button type="button" class="row x" data-act="delfile" data-i="${i}" aria-label="Прибрати">${ic('x')}</button></li>`).join('');
}
function vHw(id) {
  const h = ST.homework.find((x) => x.id === id); if (!h || isT()) return isT() && h ? (location.hash = '#/review/' + id) : vHome();
  const s = ST.submissions.find((x) => x.hwId === id && x.userId === ST.me.id);
  draft = { hw: h, files: (s?.files || []).map((f) => ({ ...f })), vocab: Object.fromEntries((s?.vocab || []).map((v) => [v.word, v.url])), answers: [] };
  const graded = s && (s.textGrade != null || s.audioGrade != null);
  const quizHtml = h.quiz?.length ? `<div class="card"><h3>Тест</h3>${s?.quiz ? `<p><b>${L('Ваш результат', 'Your result')}: ${s.quiz.score}%</b></p>` : '<p class="hint">Тест можна пройти один раз. Результат зарахується у середню оцінку.</p>'}
    ${h.quiz.map((q, i) => `<div class="q"><p>${i + 1}. ${esc(q.q)}</p>${q.options.map((o, j) => {
      const mine = s?.quiz?.answers[i]; const k = s?.quiz ? (j === q.correct ? 'right' : j === mine ? 'wrong' : '') : '';
      return `<label class="opt ${k}"><input type="radio" name="ans${i}" value="${j}" ${s?.quiz ? 'disabled' : ''} ${mine === j ? 'checked' : ''}> ${esc(o)}</label>`; }).join('')}</div>`).join('')}</div>` : '';
  shell(`${back('#/student/' + ST.me.id, 'Мій кабінет')}<div class="actions"><span class="pill"><span style="font-family:var(--display)">Д\\з</span>&nbsp;<span style="font-family:var(--body);font-weight:700">${esc(h.title)}</span></span>
      ${h.due ? `<span class="badge todo">${L('здати до', 'due')} ${fmt(h.due)}</span>` : ''}${s ? '<span class="badge ok">здано</span>' : ''}</div>
    ${graded ? `<div class="card"><h3>Оцінка вчителя</h3><p>${s.textGrade != null ? `${L('Письмова робота', 'Written work')}: <b>${s.textGrade}%</b>. ` : ''}${s.audioGrade != null ? `${L('Голосове завдання', 'Voice task')}: <b>${s.audioGrade}%</b>.` : ''}</p>${s.comment ? `<p>${esc(s.comment)}</p>` : ''}</div>` : ''}
    <div class="hw3"><section class="pane"><h3>завдане д\\з</h3><div class="prose">${h.description ? md(h.description) : '<p class="hint">Опис не додано.</p>'}</div></section>
      <section class="pane"><h3>написати завдання текстом</h3><div><textarea id="hw-text" aria-label="Ваша відповідь">${esc(s?.text || '')}</textarea></div></section>
      <section class="pane"><h3>завантажити завдання</h3><div><label class="drop" id="drop" for="hw-file"><img src="/img/upload.png" alt=""><span>PDF, Word, зображення. Перетягніть файли сюди або натисніть.</span></label>
        <input id="hw-file" type="file" multiple hidden accept=".pdf,.doc,.docx,.txt,image/*"><ul class="files" id="fl"></ul>
        <label for="hw-doc" style="display:grid;gap:4px;margin-top:12px;font-weight:700;font-size:15px">Або посилання на Google Документ<input id="hw-doc" type="url" placeholder="https://docs.google.com/…" value="${esc(s?.docLink || '')}"></label>
        <p class="hint">У Google Документі відкрийте доступ «усі, хто має посилання».</p></div></section></div>
    ${h.vocab?.length ? `<div class="card"><h3>Вокабуляр: вимовте слова</h3><p class="hint">${canRec ? 'Натисніть на мікрофон, вимовте слово, натисніть ще раз, щоб зупинити. Запис можна переслухати та перезаписати.' : 'У цьому браузері запис недоступний на сторінці. Запишіть голос і додайте файл для кожного слова.'}</p><div class="vocab" id="vocab"></div></div>` : ''}
    ${quizHtml}<div class="actions" style="margin-top:20px"><button class="btn" data-act="submit" data-id="${h.id}">${s ? 'Оновити відповідь' : 'Здати завдання'}</button></div>`, 'me');
  filesDraw(); vocabDraw();
  const add = async (list) => { for (const f of list) { try { toast(L('Завантажую ', 'Uploading ') + f.name + '…'); const r = await upload(f); draft.files.push({ name: f.name, url: r.url }); filesDraw(); } catch (e) { toast(e.message); } } };
  $('#hw-file').onchange = (e) => { add([...e.target.files]); e.target.value = ''; };
  const d = $('#drop'); ['dragover', 'dragenter'].forEach((ev) => d.addEventListener(ev, (e) => { e.preventDefault(); d.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => d.addEventListener(ev, () => d.classList.remove('over')));
  d.addEventListener('drop', (e) => { e.preventDefault(); add([...e.dataTransfer.files]); });
}

/* ---------- перевірка (вчитель) ---------- */
const openRv = new Set();
function vReview(id) {
  const h = ST.homework.find((x) => x.id === id); if (!h) return vHome();
  const c = cls(h.classId), studs = ST.users.filter((u) => u.classId === h.classId);
  const rows = studs.map((u) => {
    const s = ST.submissions.find((x) => x.hwId === id && x.userId === u.id);
    const body = !s ? '<p class="hint">Ще не здано.</p>' : `
      ${s.text ? `<div><b>Текст</b><div class="prose" style="white-space:pre-wrap">${esc(s.text)}</div></div>` : ''}
      ${s.docLink ? `<div><b>Google Документ</b><br><a href="${esc(s.docLink)}" target="_blank" rel="noopener">${esc(s.docLink)}</a></div>` : ''}
      ${s.files?.length ? `<div><b>Файли</b><ul class="files">${s.files.map((f) => `<li><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.name)}</a></li>`).join('')}</ul></div>` : ''}
      ${s.vocab?.length ? `<div><b>Голосові записи</b><div class="vocab">${s.vocab.map((v) => `<div class="vw"><div class="w">${esc(v.word)}</div><div class="ctl"><audio controls preload="none" src="${esc(v.url)}"></audio></div></div>`).join('')}</div></div>` : ''}
      ${s.quiz ? `<div><b>Тест:</b> ${s.quiz.score}%</div>` : ''}
      <form class="f" data-form="grade" data-hw="${id}" data-u="${u.id}"><div class="gradebox">
        <label for="g-t-${u.id}">Письмова, %<input id="g-t-${u.id}" type="number" name="textGrade" min="0" max="100" value="${s.textGrade ?? ''}"></label>
        <label for="g-a-${u.id}">Голос, %<input id="g-a-${u.id}" type="number" name="audioGrade" min="0" max="100" value="${s.audioGrade ?? ''}"></label>
        <label for="g-c-${u.id}">Коментар<input id="g-c-${u.id}" type="text" name="comment" value="${esc(s.comment)}"></label></div>
        <div class="actions"><button class="btn" type="submit">Зберегти оцінку</button><span class="hint">${L('Середня за тему', 'Topic average')} «${esc(h.topic || L('Без теми', 'No topic'))}»: ${(topicScores(u.id).find((t) => t.topic === (h.topic || 'Без теми')) || {}).score ?? '—'}${topicScores(u.id).find((t) => t.topic === (h.topic || 'Без теми')) ? '%' : ''}</span></div></form>`;
    const st = !s ? '<span class="badge todo">не здано</span>' : (s.textGrade != null || s.audioGrade != null) ? '<span class="badge ok">оцінено</span>' : '<span class="badge">чекає перевірки</span>';
    return `<details class="rv" data-u="${u.id}" ${openRv.has(u.id) ? 'open' : ''}><summary>${photo(u.photoUrl, 'avatar')} ${esc(u.name)} ${st}</summary><div>${body}</div></details>`;
  }).join('') || '<div class="empty">У групі ще немає учнів.</div>';
  shell(`${back('#/class/' + h.classId, c?.name || 'Група')}<div class="actions"><span class="pill">Д\\з&nbsp;<span style="font-family:var(--body)">${esc(h.title)}</span></span><a class="btn ghost" href="#/hw-edit/${id}">${ic('edit')} Редагувати</a></div>
    <p class="hint">${L('Тема', 'Topic')}: ${esc(h.topic || L('без теми', 'no topic'))}${h.due ? L(' · здати до ', ' · due ') + fmt(h.due) : ''}${h.quiz?.length ? L(' · тест: ' + h.quiz.length + ' пит.', ' · quiz: ' + h.quiz.length + ' questions') : ''}${h.vocab?.length ? L(' · слів для озвучення: ', ' · words to pronounce: ') + h.vocab.length : ''}</p>${rows}`, 'home');
  $$('details.rv').forEach((d) => d.addEventListener('toggle', () => (d.open ? openRv.add(d.dataset.u) : openRv.delete(d.dataset.u))));
}

/* ---------- журнал: усі учні, перетягування по групах ---------- */
function vJournal() {
  const cols = [{ id: '', name: 'Без групи', kind: 'none' }, ...ST.classes.filter((c) => c.kind === 'group'), ...ST.classes.filter((c) => c.kind === 'individual')];
  const known = new Set(ST.classes.map((c) => c.id));
  const stu = (u) => { const a = avg(u.id);
    return `<div class="stu" draggable="true" data-drag-u="${u.id}" data-name="${esc(u.name.toLowerCase())}">${photo(u.photoUrl, 'avatar')}
      <a class="nm" href="#/student/${u.id}">${esc(u.name)}</a><span class="d">${a == null ? '' : a + '%'}</span>
      <select class="mv" data-move="${u.id}" aria-label="${L('Перемістити', 'Move')} ${esc(u.name)}"><option value="">Перемістити…</option>${cols.filter((c) => c.id !== (known.has(u.classId) ? u.classId : '')).map((c) => `<option value="${c.id}" data-none="${c.kind === 'none' ? 1 : ''}">${esc(c.name)}</option>`).join('')}</select></div>`; };
  const col = (c) => { const list = ST.users.filter((u) => (c.id ? u.classId === c.id : !known.has(u.classId)));
    return `<section class="jcol"><h3>${esc(c.name)} <span class="badge">${list.length}</span></h3><div class="zone" data-drop-class="${c.id}">${list.map(stu).join('') || '<div class="empty">Перетягніть учня сюди</div>'}</div></section>`; };
  shell(`<div class="calhead"><h2 style="font-size:clamp(20px,3vw,28px)">Журнал</h2><span class="badge">${L('усього учнів', 'students total')}: ${ST.users.length}</span>
    <input id="jsearch" type="text" placeholder="Пошук учня" aria-label="Пошук учня" style="max-width:240px"></div>
    <p class="hint">Перетягніть учня в потрібну групу. Якщо він уже в групі, його буде перенесено. На телефоні скористайтесь списком «Перемістити…».</p>
    <div class="jgrid">${cols.map(col).join('')}</div>`, 'journal');
  $('#jsearch').oninput = (e) => { const q = e.target.value.trim().toLowerCase(); $$('.stu').forEach((x) => (x.hidden = !!q && !x.dataset.name.includes(q))); };
}
async function moveUser(uid, classId) {
  const u = usr(uid); if (!u || (u.classId || '') === (classId || '')) return;
  try { await api(`/users/${uid}/class`, 'POST', { classId: classId || null }); await load(); route(); toast(`${u.name}: ${classId ? cls(classId).name : L('без групи', 'no group')}`); } catch (e) { toast(e.message); }
}
async function moveLesson(id, date) {
  const l = ST.lessons.find((x) => x.id === id); if (!l || l.date === date) return;
  try { await api(`/lessons/${id}/move`, 'POST', { date }); await load(); route(); toast(L('Урок перенесено на ', 'Lesson moved to ') + fmt(date)); } catch (e) { toast(e.message); }
}
let dragU = null, dragL = null;
const clearOver = () => $$('.over').forEach((x) => x.classList.remove('over'));
document.addEventListener('dragstart', (e) => {
  const u = e.target.closest?.('[data-drag-u]'), l = e.target.closest?.('[data-drag-l]');
  if (u) dragU = u.dataset.dragU; else if (l) dragL = l.dataset.dragL; else return;
  e.dataTransfer.setData('text/plain', dragU || dragL); e.dataTransfer.effectAllowed = 'move';
});
document.addEventListener('dragover', (e) => {
  const z = dragU ? e.target.closest?.('[data-drop-class]') : dragL ? e.target.closest?.('[data-drop-date]') : null;
  if (!z) return; e.preventDefault(); if (!z.classList.contains('over')) { clearOver(); z.classList.add('over'); }
});
document.addEventListener('drop', (e) => {
  const zc = dragU && e.target.closest?.('[data-drop-class]'), zd = dragL && e.target.closest?.('[data-drop-date]');
  if (zc) { e.preventDefault(); moveUser(dragU, zc.dataset.dropClass); } else if (zd) { e.preventDefault(); moveLesson(dragL, zd.dataset.dropDate); }
  clearOver();
});
document.addEventListener('dragend', () => { dragU = dragL = null; clearOver(); });
document.addEventListener('change', (e) => { const sel = e.target.closest?.('[data-move]'); if (sel && sel.value !== '' || (sel && sel.selectedOptions[0]?.dataset.none)) moveUser(sel.dataset.move, sel.value); });

/* ---------- профіль ---------- */
function vProfile() {
  const me = ST.me;
  shell(`<h2 style="font-size:22px;margin-top:10px">Профіль</h2><form class="f card" data-form="profile" style="max-width:560px">
    <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">${photo(me.photoUrl, 'photo')}<div style="width:140px;display:none"></div>
      <div><label class="btn ghost" for="p-photo" style="cursor:pointer">Завантажити фото</label><input id="p-photo" type="file" accept="image/*" hidden>
      <p class="hint">${isT() ? 'Це фото бачать усі учні.' : 'Фото допоможе вчителю вас впізнати.'}</p></div></div>
    <label for="p-n">Імʼя<input id="p-n" type="text" name="name" value="${esc(me.name)}" required></label>
    ${isT() ? '' : `<label for="p-c">Група<select id="p-c" name="classId">${ST.classes.map((c) => `<option value="${c.id}" ${c.id === me.classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>`}
    <label for="p-p">Новий пароль <span class="h">(залиште порожнім, щоб не змінювати)</span><input id="p-p" type="password" name="password" autocomplete="new-password"></label>
    ${isT() ? `<label for="p-t">Теми курсу<span class="h">По одній на рядок. Використовуються в календарі та для середньої оцінки за темою.</span><textarea id="p-t" name="topics" style="min-height:150px">${esc(ST.topics.join('\n'))}</textarea></label>` : ''}
    <div class="err" id="f-err"></div><button class="btn" type="submit" style="justify-self:start">Зберегти</button></form>`, 'profile');
  $('#p-photo').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const r = await upload(f); await api('/profile', 'POST', { photoUrl: r.url }); await load(); vProfile(); toast('Фото оновлено'); } catch (er) { toast(er.message); }
  };
}

/* ---------- дії ---------- */
const actions = {
  async logout(b) { await run(b, async () => { await api('/logout', 'POST'); ST = null; await boot(); }); },
  authmode(b) { authScreen(b.dataset.m); },
  lang() { setLang(LANG === 'uk' ? 'en' : 'uk'); if (ST) route(); else authScreen(authModeNow); },
  addclass(b) {
    const k = b.dataset.kind, m = modal(`<h3>${k === 'group' ? 'Нова група' : 'Новий індивідуальний учень'}</h3><form class="f" data-form="addclass"><input type="hidden" name="kind" value="${k}">
      <label for="ac-n">Назва<input id="ac-n" type="text" name="name" required placeholder="${k === 'group' ? 'Група 1.7' : 'Імʼя та прізвище'}"></label>
      <div class="actions"><button class="btn" type="submit">Додати</button><button class="btn ghost" type="button" data-close>Скасувати</button></div></form>`);
    $('input[name=name]', m).focus();
  },
  async delclass(b) { if (confirm(tr('Видалити разом з уроками та завданнями цієї групи? Учні залишаться без групи.'))) await run(b, async () => { await api('/classes/' + b.dataset.id, 'DELETE'); await load(); route(); }); },
  editlink(b) {
    const l = ST.links.find((x) => x.id === b.dataset.id) || { id: '', title: '', url: '', icon: 'link' };
    const m = modal(`<h3>${l.id ? 'Змінити' : 'Нове'} посилання</h3><form class="f" data-form="savelink" data-id="${l.id}">
      <label for="l-t">Назва<input id="l-t" type="text" name="title" value="${esc(l.title)}" required></label>
      <label for="l-u">Адреса<input id="l-u" type="url" name="url" value="${esc(l.url)}" placeholder="https://"></label>
      <label for="l-i">Іконка<select id="l-i" name="icon">${['zoom', 'pdf', 'books', 'game', 'link'].map((i) => `<option value="${i}" ${i === l.icon ? 'selected' : ''}>${{ zoom: 'Відеозвʼязок', pdf: 'Документ', books: 'Книги', game: 'Гра', link: 'Посилання' }[i]}</option>`).join('')}</select></label>
      <label class="btn ghost" for="l-f" style="cursor:pointer;justify-self:start">Або своя картинка-іконка</label><input id="l-f" type="file" accept="image/*" hidden><span class="hint" id="l-fn">${l.iconUrl ? 'Власна іконка вже додана' : ''}</span>
      <input type="hidden" name="iconUrl" value="${esc(l.iconUrl || '')}">
      <div class="actions"><button class="btn" type="submit">Зберегти</button>${l.id ? '<button class="btn danger" type="button" data-act="dellink" data-id="' + l.id + '">Видалити</button>' : ''}<button class="btn ghost" type="button" data-close>Скасувати</button></div></form>`);
    $('#l-f', m).onchange = async (e) => { try { const r = await upload(e.target.files[0]); $('[name=iconUrl]', m).value = r.url; $('#l-fn', m).textContent = 'Іконку завантажено'; } catch (er) { toast(er.message); } };
  },
  async dellink(b) { await run(b, async () => { await api('/links/' + b.dataset.id, 'DELETE'); await load(); $('.modal')?.close(); route(); }); },
  newlesson(b, e) { if (e.target.closest('a')) return; newLessonModal(b.dataset.date, new URLSearchParams(location.hash.split('?')[1] || '').get('class') || ''); },
  async dellesson(b) { if (confirm(tr('Видалити урок?'))) await run(b, async () => { const l = ST.lessons.find((x) => x.id === b.dataset.id); await api('/lessons/' + b.dataset.id, 'DELETE'); await load(); location.hash = '#/calendar?class=' + l.classId; }); },
  async delhw(b) { if (confirm(tr('Видалити завдання разом з усіма зданими роботами?'))) await run(b, async () => { await api('/homework/' + b.dataset.id, 'DELETE'); await load(); location.hash = '#/'; }); },
  async deluser(b) { if (confirm(tr('Видалити учня та всі його роботи?'))) await run(b, async () => { await api('/users/' + b.dataset.id, 'DELETE'); await load(); location.hash = '#/'; }); },
  resetpw(b) {
    const m = modal(`<h3>Новий пароль учня</h3><form class="f" data-form="resetpw" data-id="${b.dataset.id}"><label for="rp">Пароль (від 4 символів)<input id="rp" type="text" name="password" required minlength="4"></label>
      <div class="actions"><button class="btn" type="submit">Зберегти</button><button class="btn ghost" type="button" data-close>Скасувати</button></div></form>`);
    $('#rp', m).focus();
  },
  addmat() {
    const url = $('#m-url').value.trim(); if (!/^https?:\/\//i.test(url)) return toast('Введіть адресу, що починається з https://');
    editMats.push({ id: '', type: detect(url), title: $('#m-title').value.trim() || url, url }); $('#m-url').value = ''; $('#m-title').value = ''; $('#matlist').innerHTML = matEditRows();
  },
  delmat(b) { editMats.splice(+b.dataset.i, 1); $('#matlist').innerHTML = matEditRows(); },
  addq() { qzSync(); qz.push({ q: '', options: ['', '', '', ''], correct: 0 }); qzDraw(); },
  delq(b) { qzSync(); qz.splice(+b.dataset.i, 1); qzDraw(); },
  delfile(b) { draft.files.splice(+b.dataset.i, 1); filesDraw(); },
  rec(b) { toggleRec(b); },
  addv() { vSyncEd(); vEd.push({ word: '', tr: '', audio: '' }); vDrawEd(); $$('#vlist .vwd').at(-1).focus(); },
  delv(b) { vSyncEd(); vEd.splice(+b.dataset.i, 1); vDrawEd(); },
  vrec(b) { vSyncEd(); const i = +b.dataset.i; startRec(b, (url) => { vSyncEd(); if (vEd[i]) vEd[i].audio = url; vDrawEd(); toast('Зразок записано'); }); },
  async submit(b) {
    await run(b, async () => {
      if (rec) throw new Error('Спершу зупиніть запис');
      const h = draft.hw;
      const answers = (h.quiz || []).map((q, i) => { const r = $(`input[name=ans${i}]:checked`); return r ? +r.value : -1; });
      await api('/submit', 'POST', { hwId: h.id, text: $('#hw-text').value, docLink: $('#hw-doc').value.trim(), files: draft.files,
        vocab: h.vocab.filter((v) => draft.vocab[v.word]).map((v) => ({ word: v.word, url: draft.vocab[v.word] })), answers });
      await load(); toast('Роботу здано'); vHw(h.id);
    });
  },
};
document.addEventListener('click', (e) => { const a = e.target.closest('[data-act]'); if (a && actions[a.dataset.act]) { if (a.dataset.act !== 'newlesson') e.preventDefault(); actions[a.dataset.act](a, e); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches?.('.day[data-act=newlesson]')) actions.newlesson(e.target, e); });

const forms = {
  async setup(f, d) { await api('/setup', 'POST', d); await boot(); },
  async register(f, d) { if (!d.classId) throw new Error('Оберіть групу'); await api('/register', 'POST', d); await boot(); },
  async login(f, d) { await api('/login', 'POST', d); await boot(); },
  async addclass(f, d) { await api('/classes', 'POST', d); await load(); $('.modal')?.close(); route(); },
  async savelink(f, d) { await api('/links', 'POST', { ...d, id: f.dataset.id || undefined }); await load(); $('.modal')?.close(); route(); },
  async resetpw(f, d) { await api(`/users/${f.dataset.id}/password`, 'POST', d); $('.modal')?.close(); toast('Пароль змінено'); },
  async newlesson(f, d) { const r = await api('/lessons', 'POST', { ...d, notes: '', materials: [] }); await load(); $('.modal')?.close(); location.hash = `#/lesson/${r.id}?edit=1`; },
  async savelesson(f, d) { await api('/lessons', 'POST', { ...d, id: f.dataset.id, materials: editMats }); await load(); location.hash = '#/lesson/' + f.dataset.id; },
  async savehw(f, d) {
    qzSync();
    vSyncEd(); const vocab = vEd.filter((v) => v.word.trim());
    const r = await api('/homework', 'POST', { ...d, id: f.dataset.id || undefined, vocab, quiz: qz.map((q) => ({ ...q, options: q.options })).filter((q) => q.q.trim()).map((q) => {
      const kept = q.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o); return { q: q.q, options: kept.map((x) => x.o), correct: Math.max(0, kept.findIndex((x) => x.i === q.correct)) }; }) });
    await load(); location.hash = '#/review/' + r.id;
  },
  async grade(f, d) { await api('/grade', 'POST', { hwId: f.dataset.hw, userId: f.dataset.u, ...d }); await load(); vReview(f.dataset.hw); toast('Оцінку збережено'); },
  async profile(f, d) {
    const body = { name: d.name, classId: d.classId, password: d.password || undefined };
    await api('/profile', 'POST', body);
    if (d.topics !== undefined) await api('/topics', 'POST', { topics: d.topics.split('\n') });
    await load(); vProfile(); toast('Збережено');
  },
};
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault();
  const btn = $('button[type=submit]', f), err = $('.err', f);
  if (err) err.textContent = '';
  await run(btn, async () => { try { await forms[f.dataset.form](f, Object.fromEntries(new FormData(f))); } catch (er) { if (err) err.textContent = er.message; else throw er; } });
});

/* ---------- маршрутизатор ---------- */
function route() {
  if (!ST) return;
  const [p, qs] = (location.hash.slice(1) || '/').split('?'), q = new URLSearchParams(qs || ''), seg = p.split('/').filter(Boolean);
  const [a, id] = seg;
  const T = isT();
  if (!a) return vHome();
  if (a === 'class' && T) return vClass(id);
  if (a === 'student') return T || id === ST.me.id ? vStudent(id) : vHome();
  if (a === 'calendar') return vCalendar(q);
  if (a === 'lesson') return vLesson(id, q);
  if (a === 'hw-edit' && T) return vHwEdit(id, q);
  if (a === 'hw') return vHw(id);
  if (a === 'review' && T) return vReview(id);
  if (a === 'journal' && T) return vJournal();
  if (a === 'profile') return vProfile();
  vHome();
}
window.addEventListener('hashchange', route);

async function boot() {
  STATUS = await api('/status');
  if (!STATUS.user) { ST = null; return authScreen(); }
  await load(); route();
}
splash().then(() => {});
boot().catch((e) => { $('#app').innerHTML = `<div class="auth"><div class="auth-card"><p class="err">${esc(e.message)}</p></div></div>`; });

document.addEventListener('change', async (e) => {
  const tg = e.target.closest?.('#linkstoggle'); if (!tg) return;
  try { await api('/settings', 'POST', { studentLinks: tg.checked }); await load(); toast(tg.checked ? 'Учні можуть додавати посилання' : 'Учні більше не можуть додавати посилання'); } catch (er) { toast(er.message); }
});
