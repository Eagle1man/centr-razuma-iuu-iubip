import { Link, NavLink } from 'react-router-dom'
import { Library } from 'lucide-react'
import { routes } from '../routes'
import { ThemeToggle } from './ThemeToggle'

/* T-1034: вход/регистрация убраны полностью — в шапке только навигация
   (Поиск ЭБС) и переключатель темы. Пункты меню берутся из routes.tsx
   по showInNav. */

export function Navigation() {
  const navItems = routes.filter((route) => route.showInNav)

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Library className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">Центр разума ЮУ ИУБиП</span>
        </Link>

        <nav className="ml-2 flex items-center gap-1">
          {navItems.map((route) => (
            <NavLink
              key={route.path}
              to={route.path}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              {route.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

export default Navigation
