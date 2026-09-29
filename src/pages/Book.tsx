import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Crown,
  FileText,
  GraduationCap,
  Heart,
  Info,
  Share2,
  Volume2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CharacterAvatar } from '@/components/CharacterAvatar'
import { CATEGORIES, getCharacterByCategory, getHeroBookLine } from '@/lib/characters'
import { getBookById } from '@/lib/libraryData'
import { useCatalog } from '@/hooks/useCatalog'
import { speakHero } from '@/lib/heroSounds'
import { usePageMeta } from '@/hooks/usePageMeta'

/* Разметка страницы издания перенесена дословно из боевой сборки Wuna
   (dump/figure-chr-carpet.txt): hero на primary-фоне, сетка 2/1 с карточкой
   героя и аннотацией, сайдбар «Об издании» + «Для студентов», блок related. */

/** Название направления — как ta(category) в бандле. */
function categoryTitle(categoryId: string): string {
  return CATEGORIES.find((item) => item.id === categoryId)?.title ?? categoryId
}

export default function Book() {
  const { id = '' } = useParams()
  const { books: catalogBooks } = useCatalog()
  const book = catalogBooks.find((item) => item.id === id) ?? getBookById(id)
  const [saved, setSaved] = useState(false)

  usePageMeta({
    title: book ? book.title : 'Книга не найдена',
    description: book?.annotation,
  })

  if (!book) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h1 className="text-3xl font-bold text-foreground mb-4">Книга не найдена</h1>
        <p className="text-muted-foreground mb-8">Возможно, издание было удалено или ссылка устарела.</p>
        <Button asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" /> В каталог
          </Link>
        </Button>
      </div>
    )
  }

  const direction = CATEGORIES.find((item) => item.id === book.categoryId)
  const related = catalogBooks.filter(
    (item) => item.categoryId === book.categoryId && item.id !== book.id
  ).slice(0, 3)
  const character = getCharacterByCategory(book.categoryId)
  const heroLine = character ? getHeroBookLine(character.categoryId, book.id) : undefined

  return (
    <div>
      <section className="bg-primary text-primary-foreground">
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100 transition-opacity mb-6"
          >
            <ArrowLeft className="h-4 w-4" /> Назад в каталог
          </Link>

          <div className="flex flex-col md:flex-row gap-8 md:items-center">
            <div
              className="w-28 h-40 md:w-36 md:h-52 rounded-lg bg-primary-foreground/15 border border-primary-foreground/25 flex items-center justify-center text-5xl flex-shrink-0"
              aria-hidden="true"
            >
              {direction?.emoji}
            </div>

            <div className="flex-1">
              <Badge className="mb-4 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/15">
                {categoryTitle(book.categoryId)}
              </Badge>

              <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-3">{book.title}</h1>

              <p className="text-lg opacity-90 mb-5">{book.author}</p>

              <div className="flex flex-wrap items-center gap-5 text-sm opacity-85">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" /> {book.year}
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> {book.pages} страниц
                </span>
                {book.readTime && (
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4" /> {book.readTime}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-3 mt-6">
                <Button variant="secondary" asChild>
                  <Link to={`/read/${book.id}`}>Читать онлайн</Link>
                </Button>
                <Button
                  variant="secondary"
                  className="bg-transparent border border-primary-foreground/40 hover:bg-primary-foreground/10"
                  onClick={() => {
                    setSaved(!saved)
                    toast.success(saved ? 'Удалено из избранного' : 'Добавлено в избранное')
                  }}
                >
                  <Heart className={`h-4 w-4 mr-2 ${saved ? 'fill-current' : ''}`} />{' '}
                  {saved ? 'В избранном' : 'Сохранить'}
                </Button>
                <Button
                  variant="secondary"
                  className="bg-transparent border border-primary-foreground/40 hover:bg-primary-foreground/10"
                  onClick={() => toast.success('Ссылка скопирована')}
                >
                  <Share2 className="h-4 w-4 mr-2" /> Поделиться
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-3 gap-10">
        <article className="md:col-span-2">
          {character && heroLine && (
            <div className="mb-8 flex items-start gap-4 rounded-xl border border-border bg-card p-4 shadow-sm animate-adam-enter">
              <CharacterAvatar id={character.id} size={48} />

              <div className="min-w-0">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Crown className="h-3.5 w-3.5 text-primary" />
                  {character.name} · {character.role}
                </p>

                <p className="text-sm text-foreground leading-relaxed">
                  {heroLine}
                  <button
                    type="button"
                    onClick={() => speakHero(heroLine, character.id)}
                    className="ml-1 inline-flex items-center rounded-md p-1 align-middle text-muted-foreground transition-colors hover:text-primary"
                    aria-label={`Прослушать реплику героя ${character.name}`}
                    title="Прослушать голосом героя"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </p>
              </div>
            </div>
          )}

          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Аннотация</p>

          <p className="text-lg text-muted-foreground leading-relaxed mb-8">{book.annotation}</p>

          <div className="max-w-prose">
            {book.content.split('\n').map((block, index) =>
              block.startsWith('## ') ? (
                <h2 key={index} className="text-2xl font-bold text-foreground mt-8 mb-4">
                  {block.replace('## ', '')}
                </h2>
              ) : block.trim() ? (
                <p key={index} className="mb-4 text-foreground leading-relaxed">
                  {block}
                </p>
              ) : null
            )}
          </div>
        </article>

        <aside className="space-y-6">
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" /> Об издании
              </h3>

              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Автор</dt>
                  <dd className="font-medium">{book.author}</dd>
                </div>

                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Год</dt>
                  <dd className="font-medium">{book.year}</dd>
                </div>

                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Страниц</dt>
                  <dd className="font-medium">{book.pages}</dd>
                </div>

                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Направление</dt>
                  <dd className="font-medium">{categoryTitle(book.categoryId)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" /> Для студентов
              </h3>

              <p className="text-sm text-muted-foreground leading-relaxed">
                Полная версия доступна зарегистрированным студентам ЮУ ИУБиП. Войдите или создайте аккаунт.
              </p>

              <div className="flex flex-col gap-2 mt-4">
                <Button asChild>
                  <Link to="/login">Войти</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/signup">Регистрация</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
      {related.length > 0 && (
        <section className="bg-muted/50">
          <div className="max-w-6xl mx-auto px-4 py-16">
            <h2 className="text-2xl font-bold text-foreground mb-8">По этому же направлению</h2>

            <div className="grid md:grid-cols-3 gap-6">
              {related.map((item) => (
                <Link key={item.id} to={`/book/${item.id}`} className="group">
                  <Card className="h-full shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                    <CardContent className="p-6">
                      <Badge variant="outline" className="mb-3">
                        {categoryTitle(item.categoryId)}
                      </Badge>

                      <h3 className="font-bold mb-2 group-hover:text-primary transition-colors">
                        {item.title}
                      </h3>

                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {item.annotation}
                      </p>

                      <span className="text-sm text-primary inline-flex items-center gap-1">
                        Открыть <ArrowLeft className="h-4 w-4 rotate-180" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
