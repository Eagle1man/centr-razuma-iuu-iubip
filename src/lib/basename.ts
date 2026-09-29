/* basename роутера (BrowserRouter) вычисляется из тега <base href>.
 *
 * Тег <base> инжектит публикация на GitHub Pages (.github/workflows/deploy.yml),
 * чтобы сайт жил в подкаталоге /centr-razuma-iuu-iubip/. Если тега нет
 * (nginx в корне домена, vite dev) — basename пустой, маршруты считаются от /.
 *
 * Вынесено из main.tsx в чистую функцию, чтобы закрыть регресс-тестом:
 * раньше запасной вариант был жёстким '/preview', и на сервере без <base>
 * ни один маршрут ('/', '/book/:id', ...) не совпадал с адресом — страница
 * оставалась пустой (белый экран без ошибок в консоли).
 */
export function resolveBasename(baseHref: string | null | undefined): string {
  // Берём только абсолютный путь: <base href="./"> не должен дать basename '.'.
  if (typeof baseHref !== 'string' || !baseHref.startsWith('/')) return ''
  // Отрезаем завершающие слэши: '/repo/' -> '/repo', '/' -> ''.
  return baseHref.replace(/\/+$/, '')
}
