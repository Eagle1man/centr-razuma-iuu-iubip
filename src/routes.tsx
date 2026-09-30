import Search from './pages/Search'
import Intake from './pages/Intake'
import NotFound from './pages/NotFound'
import { Navigate } from 'react-router-dom'

export interface RouteConfig {
  path: string
  label: string
  element: React.ReactNode
  showInNav: boolean
  layout: 'default' | 'bare'
}

/* T-1034: встроенный каталог книг и вход убраны. Главная — Поиск ЭБС.
   /intake — служебное окно библиотекаря (Excel-импорт), доступно по прямому
   URL, из меню убрано (showInNav: false), без guard — авторизации на сайте нет.
   /search оставлен как алиас главной для внешних ссылок. */

export const routes: RouteConfig[] = [
  {
    path: '/',
    label: 'Поиск ЭБС',
    element: <Search />,
    showInNav: true,
    layout: 'default'
  },
  {
    path: '/search',
    label: 'Поиск ЭБС',
    element: <Navigate to="/" replace />,
    showInNav: false,
    layout: 'default'
  },
  {
    path: '/intake',
    label: 'Приём книг',
    element: <Intake />,
    showInNav: false,
    layout: 'default'
  },
  {
    path: '*',
    label: '404',
    element: <NotFound />,
    showInNav: false,
    layout: 'default'
  }
]
