import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  BookOpen,
  Brain,
  Calculator,
  Check,
  CheckCircle,
  Copy,
  Database,
  ExternalLink,
  Gavel,
  GraduationCap,
  Hand as HandIcon,
  HeartPulse,
  Landmark,
  Library,
  Monitor,
  Pill,
  Plane,
  Plug,
  Scale,
  Search as SearchIcon,
  Sparkles,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { usePageMeta } from '@/hooks/usePageMeta'
import { fixTypos, rankSources, searchDirections } from '@/lib/fuzzySearch'
import type { Direction } from '@/lib/fuzzySearch'
import { ACADEMY_LINKS, ACADEMY_ORDER, DIRECTIONS } from '@/lib/directions'
import { askModel, clarifyQuery, copyText, searchCatalog } from '@/lib/searchApi'
import type { ClarifyCandidate, EbsSource } from '@/lib/searchApi'

type Status = 'idle' | 'loading' | 'expanding' | 'asking' | 'offline' | 'ready'

/* Иконки направлений: id -> компонент lucide (без эмодзи-заглушек). */
const ICONS: Record<string, typeof Monitor> = {
  Monitor,
  Database,
  Plug,
  CheckCircle,
  Users,
  Sparkles,
  Scale,
  HandIcon,
  Gavel,
  Landmark,
  TrendingUp,
  Calculator,
  Plane,
  Truck,
  Brain,
  UserCheck,
  HeartPulse,
  Pill,
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [sources, setSources] = useState<EbsSource[]>([])
  const [message, setMessage] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [askFailed, setAskFailed] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [expandedTerms, setExpandedTerms] = useState<string[]>([])
  const [candidates, setCandidates] = useState<ClarifyCandidate[]>([])
  const [clarifyText, setClarifyText] = useState('')
  const [activeAcademy, setActiveAcademy] = useState<string | null>(null)

  usePageMeta({
    title: 'Поиск литературы ЭБС',
    description:
      'Поиск учебной литературы по дисциплинам: карточки книг со ссылками.',
  })

  /* Живой нечёткий фильтр карточек по мере ввода (MiniSearch + Fuse.js). */
  const visible = useMemo(
    () => searchDirections(DIRECTIONS, query, 18),
    [query],
  )
  const grouped = useMemo(() => {
    const map = new Map<string, Direction[]>()
    for (const d of visible) {
      const list = map.get(d.academy) ?? []
      list.push(d)
      map.set(d.academy, list)
    }
    return ACADEMY_ORDER.filter((a) => map.has(a)).map((a) => ({
      academy: a,
      items: map.get(a) as Direction[],
      href: ACADEMY_LINKS[a] ?? 'https://www.iubip.ru',
    }))
  }, [visible])

  /** Мгновенный поиск → (если пусто) расширение моделью → уточнение или /ask. */
  const runSearch = async (raw: string, withExpand = true) => {
    const q = raw.trim()
    if (!q || status === 'loading' || status === 'asking' || status === 'expanding') return
    // Чиним очевидные опечатки ДО отправки на сервер: «медецина» в эмбеддинги
    // уходит как есть и находит не то. Пользователю показываем исправленный
    // запрос в поле, чтобы он видел, что именно ищет.
    const fixed = fixTypos(q, DIRECTIONS.flatMap((d) => d.tags))
    if (fixed !== q) {
      setQuery(fixed)
    }
    setStatus('loading')
    setMessage('')
    setAnswer(null)
    setAskFailed(false)
    setCopied(null)
    setCandidates([])
    setClarifyText('')
    setExpandedTerms([])

    let result = await searchCatalog(q)
    if (result === null) {
      setSources([])
      setStatus('offline')
      return
    }

    // Пусто на быстром пути — пробуем смысловое расширение моделью.
    if (withExpand && result.sources.length === 0) {
      setStatus('expanding')
      const wide = await searchCatalog(q, 10, 'llm')
      if (wide && wide.sources.length > 0) {
        result = wide
      }
    }

    const ranked = rankSources(q, result.sources)
    setSources(ranked)
    setMessage(result.message)
    setExpandedTerms(result.expanded_terms ?? [])

    if (ranked.length > 0) {
      setStatus('ready')
      return
    }

    // Ничего не нашли: спрашиваем уточнение у модели (реальные варианты из фонда).
    setStatus('asking')
    const clarify = await clarifyQuery(q, 'llm') ?? (await clarifyQuery(q, 'fast'))
    if (clarify && clarify.candidates.length > 0) {
      setCandidates(clarify.candidates)
      setClarifyText(clarify.message)
      setStatus('ready')
      return
    }

    const text = await askModel(q)
    if (text === null) setAskFailed(true)
    else setAnswer(text)
    setStatus('ready')
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void runSearch(query)
  }

  const onDirectionClick = (d: Direction) => {
    setQuery(d.query)
    setActiveAcademy(d.academy)
    void runSearch(d.query)
  }

  const onCandidateClick = (term: string) => {
    setQuery(term)
    void runSearch(term)
  }

  const copyOne = async (key: string, text: string) => {
    const ok = await copyText(text)
    if (ok) {
      setCopied(key)
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000)
    }
  }

  const copyAll = () => {
    const list = sources.map((s, i) => `${i + 1}. ${s.gost}`).join('\n')
    void copyOne('__all__', list)
  }

  const busy = status === 'loading' || status === 'asking' || status === 'expanding'

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Library className="h-4 w-4" />
        Поиск книг для студентов
      </p>
      <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">
        Поиск литературы по предмету
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Введите предмет — например «экономика» или «право». Поиск понимает опечатки и
        неполные слова, а если тема неоднозначна — уточнит у вас.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex max-w-2xl gap-2">
        <label className="relative flex-1">
          <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Например: право, экономика, базы данных"
            aria-label="Предмет для поиска"
            className="pl-9"
            autoComplete="off"
          />
        </label>
        <Button type="submit" disabled={busy || !query.trim()}>
          {status === 'asking'
            ? 'Спрашиваем…'
            : status === 'expanding'
              ? 'Уточняем…'
              : status === 'loading'
                ? 'Ищем…'
                : 'Найти'}
        </Button>
      </form>

      {expandedTerms.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Искали также: {expandedTerms.join(', ')}
        </p>
      )}

      <section aria-label="Направления академий ИУБиП" className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <GraduationCap className="h-5 w-5 text-muted-foreground" />
          Направления академий ИУБиП
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Что вы изучите в вузе и какие книги по этим дисциплинам искать в ЭБС.
          Клик по карточке запускает реальный поиск. Введите запрос — карточки
          отфильтруются на лету, с учётом опечаток.
        </p>
        {grouped.map((group) => (
          <div key={group.academy} className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {group.academy}
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((d) => {
                const Icon = ICONS[d.icon] ?? Monitor
                const active = activeAcademy === d.academy
                return (
                  <Card
                    key={d.id}
                    className={`flex cursor-pointer flex-col transition-colors hover:border-primary/60 ${
                      active ? 'border-primary/70' : ''
                    }`}
                    onClick={() => onDirectionClick(d)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onDirectionClick(d)
                      }
                    }}
                    aria-label={`Искать: ${d.query}`}
                  >
                    <div className="m-4 flex h-24 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-9 w-9 text-primary" aria-hidden="true" />
                    </div>
                    <CardHeader>
                      <CardTitle className="text-base leading-snug">{d.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {d.text}
                    </CardContent>
                    <CardContent>
                      <div className="flex flex-wrap gap-1.5">
                        {d.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="mt-auto flex flex-wrap items-center justify-between gap-2">
                      <a
                        href={group.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary hover:underline"
                      >
                        Страница академии
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <Button size="sm" variant="outline">
                        Открыть
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <Card className="mt-4 bg-muted/50">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              По вашему запросу направления не нашлись. Попробуйте короче — например
              «право» или «IT».
            </CardContent>
          </Card>
        )}
      </section>

      {status === 'idle' && (
        <Card className="mt-8 max-w-2xl bg-muted/50">
          <CardContent className="flex items-start gap-3 pt-6 text-sm text-muted-foreground">
            <BookOpen className="mt-0.5 h-4 w-4 shrink-0" />
            Введите название предмета и нажмите «Найти». Поиск понимает опечатки и
            неполные слова; если тема неоднозначна — уточним у вас. Если точный запрос
            ничего не даст, спросим языковую модель.
          </CardContent>
        </Card>
      )}

      {status === 'offline' || status === 'loading' || status === 'asking' || status === 'expanding' ? (
        <Card className="mt-8 max-w-2xl bg-muted/50">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {status === 'loading' && 'Ищем книги в ЭБС…'}
            {status === 'expanding' && 'Расширяем запрос через модель, это займёт до минуты…'}
            {status === 'asking' && 'Спрашиваю модель, это займет около минуты…'}
            {status === 'offline' &&
              'Поиск временно недоступен: нет связи с сервером. Попробуйте позже или включите mock-режим.'}
          </CardContent>
        </Card>
      ) : null}

      {status === 'ready' && (
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {message || `Найдено источников: ${sources.length}`}
            </p>
            {sources.length > 0 && (
              <Button variant="outline" size="sm" onClick={copyAll}>
                {copied === '__all__' ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {copied === '__all__' ? 'Скопировано' : 'Скопировать всё'}
              </Button>
            )}
          </div>

          {candidates.length > 0 && (
            <Card className="mt-4 max-w-2xl border-primary/40">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge>
                    <Sparkles className="mr-1 h-3 w-3" />
                    уточните запрос
                  </Badge>
                </div>
                {clarifyText && (
                  <p className="mt-2 text-sm text-muted-foreground">{clarifyText}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {candidates.map((c) => (
                    <Button
                      key={c.term}
                      size="sm"
                      variant="outline"
                      onClick={() => onCandidateClick(c.term)}
                    >
                      {c.term}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {sources.length === 0 ? (
            answer !== null ? (
              <Card className="mt-4 max-w-2xl">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">
                      <Sparkles className="mr-1 h-3 w-3" />
                      ответ модели
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="whitespace-pre-wrap text-sm leading-relaxed">
                  {answer}
                </CardContent>
              </Card>
            ) : candidates.length === 0 ? (
              <Card className="mt-4 max-w-2xl bg-muted/50">
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  {askFailed
                    ? 'По запросу релевантной литературы не найдено, и модель сейчас недоступна. Попробуйте сформулировать тему другими словами.'
                    : 'По запросу релевантной литературы не найдено. Попробуйте сформулировать тему другими словами.'}
                </CardContent>
              </Card>
            ) : null
          ) : (
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {sources.map((book, index) => {
                const key = `${book.title}-${index}`
                return (
                  <Card key={key} className="flex flex-col">
                    <CardHeader>
                      <div className="flex flex-wrap gap-1.5">
                        {book.ebbs_label && <Badge>{book.ebbs_label}</Badge>}
                        {book.year && <Badge variant="outline">{book.year}</Badge>}
                      </div>
                      <CardTitle className="mt-3 text-base leading-snug">
                        {book.title}
                      </CardTitle>
                      {book.authors && (
                        <p className="text-sm text-muted-foreground">{book.authors}</p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {book.annotation && (
                        <p className="line-clamp-4 text-muted-foreground">
                          {book.annotation}
                        </p>
                      )}
                      <p className="rounded-md bg-muted/60 p-2 text-xs leading-relaxed">
                        {book.gost}
                      </p>
                    </CardContent>
                    <CardFooter className="mt-auto flex flex-wrap gap-2">
                      {book.url && (
                        <Button size="sm" variant="outline" asChild>
                          <a
                            href={book.url}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            Открыть в ЭБС
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void copyOne(key, book.gost)}
                      >
                        {copied === key ? (
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                        ) : (
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {copied === key ? 'Скопировано' : 'Скопировать запись'}
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
