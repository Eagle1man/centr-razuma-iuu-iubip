import { useEffect } from 'react'
import { Route, Routes, useLocation, matchPath } from 'react-router-dom'
import { ThemeProvider } from '@/hooks/useTheme'
import { Toaster } from '@/components/ui/sonner'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import AdamAssistant from './components/AdamAssistantPanel'
import { getBookById } from './lib/libraryData'
import { routes } from './routes'

/* ВОССТАНОВЛЕНО: файл не дошёл в дампе. Роутинг берётся из routes.tsx,
   чтобы App оставался тонким: он только раскладывает маршруты по раскладкам
   default/bare и подключает общие обёртки. */

function AppShell() {
  const location = useLocation()

  /* E2E-признак «React смонтировался»: проставляется только после реального
     mount, поэтому проверка не может пройти на статичном index.html. */
  useEffect(() => {
    document.documentElement.dataset.spaMounted = 'true'
  }, [])

  const active = routes.find((route) => matchPath(route.path, location.pathname))

  /* Страница издания передаёт панели героев своё направление (в бандле — проп
     initialCategory у xC/bC): герой раздела оказывается выбран сразу. */
  const bookMatch = matchPath('/book/:id', location.pathname)
  const initialCategory = bookMatch?.params.id
    ? getBookById(bookMatch.params.id)?.categoryId
    : undefined

  return (
    <div className="preload-guard" key={location.pathname} data-e2e="razum-app">
      <Routes>
        {routes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <Layout layout={route.layout}>
                <ErrorBoundary>{route.element}</ErrorBoundary>
              </Layout>
            }
          />
        ))}
      </Routes>
      {active?.layout !== 'bare' && <AdamAssistant initialCategory={initialCategory} />}
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
      <Toaster position="top-right" />
    </ThemeProvider>
  )
}