'use strict';
/* Переклад інтерфейсу: основний текст українською, англійський шар накладається поверх. */
let LANG = 'uk';
try { LANG = localStorage.getItem('lang') === 'en' ? 'en' : 'uk'; } catch {}
document.documentElement.lang = LANG;
const L = (uk, en) => (LANG === 'en' ? en : uk);
const LOC = () => (LANG === 'en' ? 'en-GB' : 'uk-UA');

const DICT = {
  'Помилка': 'Error', 'Д\\з': 'HW', 'Не вдалося завантажити': 'Upload failed', 'Без теми': 'No topic',
  'Головна': 'Home', 'Журнал': 'Register', 'Календар': 'Calendar', 'Мій кабінет': 'My page', 'Профіль': 'Profile', 'Вийти': 'Log out',
  'Перший запуск. Створіть акаунт вчителя.': 'First launch. Create the teacher account.',
  'Вхід': 'Log in', 'Реєстрація учня': 'Student sign-up', 'Ваше імʼя': 'Your name', 'Імʼя та прізвище': 'First and last name',
  'Пароль': 'Password', 'Код запуску': 'Setup code', 'Той, що ви задали в налаштуваннях хостингу (SETUP_CODE)': 'The one you set in the hosting settings (SETUP_CODE)',
  'Оберіть свою групу': 'Choose your group', 'ГРУПИ': 'GROUPS', 'ІНДИВІДУАЛЬНІ': 'INDIVIDUAL',
  'Створити акаунт вчителя': 'Create teacher account', 'Увійти': 'Log in', 'Зареєструватися': 'Sign up',
  'Урок': 'Lesson', 'нове': 'new', 'оцінено': 'graded', 'здано': 'submitted', 'Нове завдання': 'New homework',
  'Пройдений матеріал': 'Completed material', 'Поки порожньо': 'Nothing here yet', 'завдане д\\з': 'homework', 'Завдань немає': 'No homework',
  'наступні уроки': 'upcoming lessons', 'Уроки ще не заплановано': 'No lessons scheduled yet',
  'Змінити': 'Edit', 'Посилання ще не додано': 'No link added yet', 'Учні можуть додавати власні посилання': 'Students can add their own links',
  'корисні посилання': 'useful links', 'Немає посилань': 'No links', 'Додати': 'Add', 'Видалити': 'Delete',
  'Додайте перший запис кнопкою +': 'Add the first one with the + button', 'групи': 'groups', 'Додати групу': 'Add group',
  'індивідуальні': 'individual', 'Учні без групи': 'Students without a group', 'моя група': 'my group', 'відкрити →': 'open →',
  'Групу не обрано. Оберіть у профілі.': 'No group chosen. Choose one in your profile.', 'ваш вчитель': 'your teacher',
  'Всі групи': 'All groups', 'Нове д/з': 'New homework', 'Додати урок у календарі': 'Add a lesson in the calendar',
  'календар': 'lesson', 'занять': 'calendar', 'ще без оцінок': 'no grades yet',
  'У групі ще немає учнів. Учні обирають групу під час реєстрації.': 'No students in this group yet. Students pick a group when they sign up.',
  'Новий пароль': 'New password', 'Видалити учня': 'Delete student', 'Без групи': 'No group', 'середня оцінка': 'average grade',
  'Учня не прикріплено до групи.': 'The student is not in any group.', 'Оцінки за темами': 'Grades by topic',
  'Оцінки зʼявляться після першого тесту або перевіреної роботи. Середнє за темою рахується з результатів тестів і оцінок вчителя.': 'Grades appear after the first quiz or checked work. The topic average is calculated from quiz results and teacher grades.',
  'Пн': 'Mon', 'Вт': 'Tue', 'Ср': 'Wed', 'Чт': 'Thu', 'Пт': 'Fri', 'Сб': 'Sat', 'Нд': 'Sun',
  'Створити урок': 'Create lesson', 'Група': 'Group', 'Усі групи': 'All groups', 'Попередній місяць': 'Previous month', 'Наступний місяць': 'Next month', 'Сьогодні': 'Today',
  'Натисніть на дату, щоб створити урок. Щоб змінити дату, перетягніть урок на інший день.': 'Click a date to create a lesson. Drag a lesson to another day to change its date.',
  'Час': 'Time', 'Тема': 'Topic', 'Скасувати': 'Cancel',
  'Редагувати': 'Edit', 'Домашнє завдання': 'Homework', 'Конспект': 'Lesson notes', 'Конспект ще не додано.': 'No notes yet.',
  'Матеріали': 'Materials', 'Матеріалів немає.': 'No materials.', 'Домашнє завдання до уроку': 'Homework for this lesson', 'Прибрати': 'Remove',
  'Додайте посилання, картинки, відео, PDF або аудіо.': 'Add links, images, videos, PDF or audio.', 'До уроку': 'Back to lesson',
  'Редагування уроку': 'Edit lesson', 'Дата': 'Date', 'Назва уроку (необовʼязково)': 'Lesson title (optional)',
  'Порожній рядок розділяє абзаци. «- » на початку рядка робить список, **текст** робить жирним, посилання стають клікабельними.': 'A blank line separates paragraphs. "- " at the start of a line makes a list, **text** makes bold, links become clickable.',
  'Посилання (сайт, YouTube, Google Документ…)': 'Link (website, YouTube, Google Doc…)', 'Назва посилання': 'Link title',
  'показується на картці матеріалу, можна залишити порожнім': 'shown on the material card, can be left empty',
  'Додати посилання': 'Add link', 'Завантажити файл': 'Upload file', 'Зберегти': 'Save',
  'Питання': 'Question', 'Прибрати питання': 'Remove question', 'Тест необовʼязковий. Позначте кружечком правильну відповідь.': 'The quiz is optional. Mark the correct answer with the circle.',
  'Слово': 'Word', 'Переклад': 'Translation', 'Записати зразок вимови': 'Record a pronunciation sample', 'Файл зі зразком вимови': 'Pronunciation sample file',
  'Прибрати слово': 'Remove word', 'Слів немає. Вокабуляр необовʼязковий.': 'No words. Vocabulary is optional.',
  'Назад': 'Back', 'Редагування': 'Editing', 'Нове': 'New', 'домашнє завдання': 'homework', 'Без привʼязки': 'Not linked', 'Назва': 'Title',
  'Тема (для середньої оцінки)': 'Topic (for the average grade)', 'Завдання для учня': 'Task for the student', 'Здати до': 'Due date',
  'Вокабуляр для озвучення': 'Vocabulary to pronounce',
  'Додайте слова. Можна записати власну вимову як зразок, учень почує її й запише свою.': 'Add words. You can record your own pronunciation as a sample; the student will hear it and record theirs.',
  'Додати слово': 'Add word', 'Тест за пройденим матеріалом': 'Quiz on the covered material', 'Додати питання': 'Add question', 'Видалити завдання': 'Delete homework',
  'Зразок': 'Sample', 'Ваш запис': 'Your recording', 'Перезаписати': 'Re-record',
  'Спершу зупиніть поточний запис': 'Stop the current recording first', 'Дозвольте доступ до мікрофона в налаштуваннях браузера': 'Allow microphone access in your browser settings',
  'Запис збережено. Не забудьте натиснути «Здати».': 'Recording saved. Don\'t forget to press "Submit".', 'Тест': 'Quiz',
  'Тест можна пройти один раз. Результат зарахується у середню оцінку.': 'The quiz can be taken once. The result counts toward the average grade.',
  'Оцінка вчителя': 'Teacher\'s grade', 'Опис не додано.': 'No description.', 'написати завдання текстом': 'write the answer as text',
  'Ваша відповідь': 'Your answer', 'завантажити завдання': 'upload your work',
  'PDF, Word, зображення. Перетягніть файли сюди або натисніть.': 'PDF, Word, images. Drag files here or click.',
  'Або посилання на Google Документ': 'Or a link to a Google Doc', 'У Google Документі відкрийте доступ «усі, хто має посилання».': 'In the Google Doc, set access to "anyone with the link".',
  'Вокабуляр: вимовте слова': 'Vocabulary: say the words',
  'Натисніть на мікрофон, вимовте слово, натисніть ще раз, щоб зупинити. Запис можна переслухати та перезаписати.': 'Press the microphone, say the word, press again to stop. You can listen to the recording and record again.',
  'У цьому браузері запис недоступний на сторінці. Запишіть голос і додайте файл для кожного слова.': 'Recording is not available on this page in this browser. Record your voice and add a file for each word.',
  'Оновити відповідь': 'Update answer', 'Здати завдання': 'Submit homework', 'Ще не здано.': 'Not submitted yet.', 'Текст': 'Text',
  'Google Документ': 'Google Doc', 'Файли': 'Files', 'Голосові записи': 'Voice recordings', 'Письмова, %': 'Written, %', 'Голос, %': 'Voice, %', 'Коментар': 'Comment',
  'Зберегти оцінку': 'Save grade', 'не здано': 'not submitted', 'чекає перевірки': 'awaiting review', 'У групі ще немає учнів.': 'No students in this group yet.',
  'Перемістити…': 'Move…', 'Перетягніть учня сюди': 'Drag a student here', 'Пошук учня': 'Search student',
  'Перетягніть учня в потрібну групу. Якщо він уже в групі, його буде перенесено. На телефоні скористайтесь списком «Перемістити…».': 'Drag a student to the right group. If the student is already in a group, they will be moved. On a phone, use the "Move…" list.',
  'Завантажити фото': 'Upload photo', 'Це фото бачать усі учні.': 'All students can see this photo.', 'Фото допоможе вчителю вас впізнати.': 'The photo helps the teacher recognise you.',
  'Імʼя': 'Name', '(залиште порожнім, щоб не змінювати)': '(leave empty to keep it)', 'Теми курсу': 'Course topics',
  'По одній на рядок. Використовуються в календарі та для середньої оцінки за темою.': 'One per line. Used in the calendar and for the topic average grade.',
  'Фото оновлено': 'Photo updated', 'Нова група': 'New group', 'Новий індивідуальний учень': 'New individual student', 'Група 1.7': 'Group 1.7',
  'Видалити разом з уроками та завданнями цієї групи? Учні залишаться без групи.': 'Delete this group together with its lessons and homework? Students will be left without a group.',
  'Адреса': 'Address', 'Іконка': 'Icon', 'Відеозвʼязок': 'Video call', 'Документ': 'Document', 'Книги': 'Books', 'Гра': 'Game', 'Посилання': 'Link',
  'Або своя картинка-іконка': 'Or your own icon image', 'Власна іконка вже додана': 'Custom icon already added', 'Іконку завантажено': 'Icon uploaded',
  'Видалити урок?': 'Delete this lesson?', 'Видалити завдання разом з усіма зданими роботами?': 'Delete the homework together with all submitted work?',
  'Видалити учня та всі його роботи?': 'Delete the student and all their work?', 'Новий пароль учня': 'New student password', 'Пароль (від 4 символів)': 'Password (at least 4 characters)',
  'Введіть адресу, що починається з https://': 'Enter an address starting with https://', 'Зразок записано': 'Sample recorded', 'Спершу зупиніть запис': 'Stop the recording first',
  'Роботу здано': 'Work submitted', 'Оберіть групу': 'Choose a group', 'Пароль змінено': 'Password changed', 'Оцінку збережено': 'Grade saved', 'Збережено': 'Saved',
  'Учні можуть додавати посилання': 'Students can add links', 'Учні більше не можуть додавати посилання': 'Students can no longer add links',
  /* повідомлення сервера */
  'Імʼя та пароль (від 6 символів) обовʼязкові': 'Name and password (at least 6 characters) are required', 'Введіть назву завдання': 'Enter a homework title', 'Введіть назву': 'Enter a name',
  'Введіть імʼя та прізвище': 'Enter first and last name', 'Вчителя вже створено': 'The teacher account already exists', 'Групу не знайдено': 'Group not found',
  'Забагато спроб. Спробуйте за кілька хвилин.': 'Too many attempts. Try again in a few minutes.', 'Завдання не знайдено': 'Homework not found', 'Не знайдено': 'Not found',
  'Невірне імʼя або пароль': 'Wrong name or password', 'Невірний код запуску': 'Wrong setup code', 'Недостатньо прав': 'Not allowed', 'Некоректна дата': 'Invalid date',
  'Некоректні дані': 'Invalid data', 'Пароль від 4 символів': 'Password must be at least 4 characters', 'Порожній файл': 'Empty file', 'Потрібно увійти': 'Please log in',
  'Роботу не знайдено': 'Work not found', 'Таке імʼя вже зареєстроване. Увійдіть або додайте щось до імені.': 'This name is already registered. Log in or add something to the name.',
  'Таке імʼя вже є': 'This name already exists', 'Урок не знайдено': 'Lesson not found', 'Учень може змінювати лише свої посилання': 'Students can only change their own links',
  'Учня не знайдено': 'Student not found', 'Файл завеликий': 'File is too large',
  'Цей тип файлу не підтримується (pdf, doc, docx, txt, зображення, аудіо, відео)': 'This file type is not supported (pdf, doc, docx, txt, images, audio, video)',
  'Помилка сервера': 'Server error',
};

function tr(s) {
  if (LANG !== 'en' || !s) return s;
  const m = /^(\s*[←→+×]*\s*)([\s\S]*?)(\s*)$/.exec(s);
  let r = m && m[2] && DICT[m[2]];
  if (!r && m && /^Група \d[\d.]*$/.test(m[2])) r = m[2].replace('Група', 'Group');
  return r === undefined || r === '' || r === false || !m ? s : m[1] + r + m[3];
}
function trTree(root) {
  if (LANG !== 'en') return;
  if (root.nodeType === 3) { if (!/^(TEXTAREA|SCRIPT|STYLE)$/.test(root.parentNode?.nodeName || '')) { const v = tr(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; } return; }
  if (root.nodeType !== 1) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (/^(TEXTAREA|SCRIPT|STYLE)$/.test(n.parentNode.nodeName)) continue;
    const v = tr(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v;
  }
  [root, ...root.querySelectorAll('[placeholder],[aria-label],[title],[alt]')].forEach((el) => {
    for (const a of ['placeholder', 'aria-label', 'title', 'alt']) { const v = el.getAttribute?.(a); if (v) { const t = tr(v); if (t !== v) el.setAttribute(a, t); } }
  });
}
new MutationObserver((muts) => { if (LANG === 'en') for (const m of muts) m.addedNodes.forEach(trTree); }).observe(document.documentElement, { childList: true, subtree: true });
function setLang(l) { LANG = l; try { localStorage.setItem('lang', l); } catch {} document.documentElement.lang = l; }
