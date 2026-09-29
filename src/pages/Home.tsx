import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, BookOpen, GraduationCap, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import BuildingOutline from '@/components/BuildingOutline'
import { CharacterBadge } from '@/components/CharacterAvatar'
import { CATEGORIES } from '@/lib/characters'
import { useCatalog } from '@/hooks/useCatalog'
import { usePageMeta } from '@/hooks/usePageMeta'

/* ВОССТАНОВЛЕНО: страница не дошла в дампе. Раскладка — по design-system.json:
   полноширинный hero на bg-primary, секция направлений 2 колонки, каталог
   grid 3 колонки с bg-muted/50, pill-кнопки фильтров, outline-бейджи категорий. */

export default function Home() {
  const [params, setParams] = useSearchParams()
  const activeCategory = params.get('category') ?? 'all'
  const query = params.get('q') ?? ''

  usePageMeta({
    title: 'Электронная библиотека',
    description:
      'Электронная библиотека образовательной литературы ЮУ ИУБиП: туризм и гостеприимство, юриспруденция, экономика и управление, фармация и сестринское дело.',
  })

  const { books: catalogBooks } = useCatalog()

  const books = useMemo(() => {
    const byCategory =
      activeCategory === 'all'
        ? catalogBooks
        : catalogBooks.filter((book) => book.categoryId === activeCategory)

    const needle = query.trim().toLowerCase()
    if (!needle) return byCategory

    return byCategory.filter((book) =>
      [book.title, book.author, book.annotation, book.tags.join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    )
  }, [activeCategory, query, catalogBooks])

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  return (
    <div>
      <section className="bg-primary py-16 text-primary-foreground md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <p className="flex items-center gap-2 text-sm opacity-90">
            <GraduationCap className="h-4 w-4" />
            ЮУ ИУБиП · электронная библиотека
          </p>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight md:text-5xl">
            Центр разума: учебная литература и герои, которые объяснят её по шагам
          </h1>
          <p className="mt-4 max-w-2xl text-base opacity-90">
            Четыре направления подготовки, учебные пособия и ассистенты. Не хотите читать
            целиком — спросите героя раздела, он разберёт тему по пунктам и проверит вас тестом.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="secondary" asChild>
              <a href="#catalog">
                <BookOpen className="mr-2 h-4 w-4" />
                Перейти в каталог
              </a>
            </Button>
            <Button
              variant="outline"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              asChild
            >
              <Link to="/signup">Зарегистрироваться</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <BuildingOutline />
      </section>

      <section className="bg-muted/50 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-semibold text-foreground">Направления</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            У каждого раздела свой герой-ассистент.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {CATEGORIES.map((category) => (
              <Card
                key={category.id}
                className="transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">
                      {category.emoji}
                    </span>
                    <CardTitle className="text-lg">{category.title}</CardTitle>
                  </div>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardFooter className="justify-between">
                  <CharacterBadge categoryId={category.id} />
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setParam('category', category.id)}
                  >
                    Смотреть книги
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="catalog" className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Каталог литературы</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Найдено изданий: {books.length}
            </p>
          </div>

          <label className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setParam('q', event.target.value)}
              placeholder="Поиск по названию, автору, теме"
              className="w-72 pl-9"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setParam('category', 'all')}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              activeCategory === 'all'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-accent'
            }`}
          >
            Все разделы
          </button>
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setParam('category', category.id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                activeCategory === category.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {category.title}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <Card
              key={book.id}
              className="flex flex-col transition-all hover:-translate-y-1 hover:shadow-md"
            >
              <CardHeader>
                <div className="flex h-24 items-center justify-center rounded-lg bg-primary/10 text-4xl">
                  <span aria-hidden="true">{book.cover}</span>
                </div>
                <CardTitle className="mt-4 text-lg">{book.title}</CardTitle>
                <CardDescription>{book.annotation}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {book.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </CardContent>
              <CardFooter className="mt-auto justify-between">
                <span className="text-xs text-muted-foreground">
                  {book.author} · {book.year} · {book.pages} с.
                </span>
                <Button size="sm" asChild>
                  <Link to={`/book/${book.id}`}>Открыть</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}