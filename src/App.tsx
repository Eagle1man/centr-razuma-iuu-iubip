import { useEffect } from 'react'
import { Route, Routes, useLocation, matchPath } from 'react-router-dom'
import { ThemeProvider } from '@/hooks/useTheme'
import { Toaster } from '@/components/ui/sonner'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import AdamAssistant from './components/AdamAssistantPanel'
import { routes } from './routes'

/* T-1034: каталог книг убран — привязки к /book/:id и libraryData здесь
   больше нет. Роутинг берётся из routes.tsx. */

function AppShell() {
  const location = useLocation()

  /* E2E-признак «React смонтировался»: проставляется только после реального
     mount, поэтому проверка не может пройти на статичном index.html. */
  useEffect(() => {
    document.documentElement.dataset.spaMounted = 'true'
  }, [])

  const active = routes.find((route) => matchPath(route.path, location.pathname))

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
      {active?.layout !== 'bare' && <AdamAssistant />}
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
