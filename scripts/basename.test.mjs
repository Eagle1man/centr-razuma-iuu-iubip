// Регресс-тест resolveBasename (см. src/lib/basename.ts).
// Запуск: npm run test:basename   (Node >= 22.6, скрипт тянет .ts через type stripping)
//
// Зачем тест: раньше basename жёстко падал в '/preview', и на сервере без <base>
// (nginx в корне домена) SPA показывал пустой <div id="root"> — белый экран.
import assert from 'node:assert/strict'
import { resolveBasename } from '../src/lib/basename.ts'

const cases = [
  [undefined, '', 'нет тега <base> (nginx в корне домена, vite dev)'],
  [null, '', 'атрибут href отсутствует'],
  ['', '', 'пустой href'],
  ['/', '', 'корень домена'],
  ['./', '', 'относительный href не должен давать basename "."'],
  ['../', '', 'относительный href вверх'],
  ['/centr-razuma-iuu-iubip/', '/centr-razuma-iuu-iubip', 'GitHub Pages: project pages'],
  ['/centr-razuma-iuu-iubip', '/centr-razuma-iuu-iubip', 'href без завершающего слэша'],
  ['/a/b/', '/a/b', 'вложенный путь'],
  ['/a/b///', '/a/b', 'лишние завершающие слэши'],
]

let failed = 0
for (const [input, expected, why] of cases) {
  const actual = resolveBasename(input)
  if (actual === expected) {
    console.log(`  OK   ${JSON.stringify(input)} -> ${JSON.stringify(actual)}  (${why})`)
  } else {
    failed += 1
    console.log(`  FAIL ${JSON.stringify(input)} -> ${JSON.stringify(actual)}, ожидалось ${JSON.stringify(expected)}  (${why})`)
  }
}

console.log(`\nBASENAME-ТЕСТ: ${cases.length - failed} / ${cases.length}`)
process.exit(failed === 0 ? 0 : 1)
