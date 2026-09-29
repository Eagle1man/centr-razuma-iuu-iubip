import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { initSupabase } from './lib/supabase'
import './fonts.css'
import './index.css'
import './custom.css'

// Initialize Firebase before React renders. Component effects (useAuth,
// useData) run before App's effects, so initializing in an effect would let
// those hooks run against an uninitialized SDK on first paint.
initSupabase()

/* basename роутера берём из <base href> — этот тег инжектит публикация на
   GitHub Pages (.github/workflows/deploy.yml), чтобы сайт жил в подкаталоге
   /centr-razuma-iuu-iubip/. Если тега нет (nginx в корне домена, vite dev) —
   basename пустой, то есть маршруты считаются от корня /.
   Раньше здесь стоял жёсткий запасной вариант '/preview': на сервере без
   <base> ни один из маршрутов ('/', '/book/:id', ...) не совпадал с адресом,
   и страница оставалась пустой — белый экран без ошибок в консоли. */
const baseHref = document.querySelector('base')?.getAttribute('href') ?? ''
const basename = baseHref.startsWith('/') ? baseHref.replace(/\/+$/, '') : ''

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

// Remove the no-transition guard after first paint so theme/color changes
// animate but the initial render does not flash.
requestAnimationFrame(() =>
  requestAnimationFrame(() => document.documentElement.classList.remove('preload'))
)