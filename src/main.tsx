import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { initSupabase } from './lib/supabase'
import { resolveBasename } from './lib/basename'
import './fonts.css'
import './index.css'
import './custom.css'

// Initialize Supabase before React renders (used by intake ingest calls).
initSupabase()

/* basename берём из <base href> (см. src/lib/basename.ts: логика и причина,
   почему запасной вариант не должен быть жёстким '/preview'). */
const basename = resolveBasename(document.querySelector('base')?.getAttribute('href'))

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