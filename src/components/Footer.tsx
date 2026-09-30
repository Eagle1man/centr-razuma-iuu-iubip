import { Link } from 'react-router-dom'

/* T-1034: разделы каталога и ссылки входа/регистрации/редактора убраны.
   Остаётся ссылка на главную (Поиск ЭБС). */

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-16 border-t bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2">
        <div>
          <h3 className="font-semibold text-foreground">Центр разума ЮУ ИУБиП</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Поиск учебной литературы в электронных библиотечных системах.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">Сайт</h4>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>
              <Link to="/" className="transition-colors hover:text-foreground">
                Поиск ЭБС
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t px-4 py-4">
        <p className="mx-auto max-w-6xl text-xs text-muted-foreground">
          © {year} ЮУ ИУБиП. Учебные материалы публикуются в образовательных целях.
        </p>
      </div>
    </footer>
  )
}

export default Footer
