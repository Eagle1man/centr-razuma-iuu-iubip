import { useState } from 'react'
import type { FormEvent } from 'react'
import { BookOpen, Check, Copy, ExternalLink, Library, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { usePageMeta } from '@/hooks/usePageMeta'
import { copyText, searchCatalog } from '@/lib/searchApi'
import type { EbsSource } from '@/lib/searchApi'

type Status = 'idle' | 'loading' | 'offline' | 'ready'

const STUB_TEXT = 'Поиск станет доступен после деплоя'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [sources, setSources] = useState<EbsSource[]>([])
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  usePageMeta({
    title: 'Поиск литературы ЭБС',
    description:
      'Поиск учебной литературы по дисциплинам в электронных библиотечных системах: карточки книг со ссылками и копирование списка по ГОСТ Р.',
  })

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const q = query.trim()
    if (!q || status === 'loading') return
    setStatus('loading')
    setMessage('')
    setCopied(null)
    const result = await searchCatalog(q)
    if (result === null) {
      setSources([])
      setStatus('offline')
      return
    }
    setSources(result.sources)
    setMessage(result.message)
    setStatus('ready')
  }

  const copyOne = async (key: string, text: string) => {
    const ok = await copyText(text)
    if (ok) {
      setCopied(key)
      window.setTimeout(() => {
        setCopied((current) => (current === key ? null : current))
      }, 2000)
    }
  }

  const copyAll = () => {
    const list = sources.map((s, i) => `${i + 1}. ${s.gost}`).join('\n')
    void copyOne('__all__', list)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Library className="h-4 w-4" />
        Электронные библиотечные системы · Лань и другие
      </p>
      <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">
        Поиск литературы по предмету
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Введите предмет, например «экономика». Найдём книги ЭБС со ссылками,
        а библиографические записи можно скопировать по ГОСТ Р прямо в реферат.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex max-w-2xl gap-2">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Например: экономика"
            aria-label="Предмет для поиска"
            className="pl-9"
          />
        </label>
        <Button type="submit" disabled={status === 'loading' || !query.trim()}>
          {status === 'loading' ? 'Ищем…' : 'Найти'}
        </Button>
      </form>

      {status === 'idle' && (
        <Card className="mt-8 max-w-2xl bg-muted/50">
          <CardContent className="flex items-start gap-3 pt-6 text-sm text-muted-foreground">
            <BookOpen className="mt-0.5 h-4 w-4 shrink-0" />
            Введите название предмета и нажмите «Найти». Пока бэкенд недоступен,
            здесь появится сообщение: {STUB_TEXT}.
          </CardContent>
        </Card>
      )}

      {status === 'offline' || status === 'loading' ? (
        <Card className="mt-8 max-w-2xl bg-muted/50">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {status === 'loading' ? 'Ищем книги в ЭБС…' : STUB_TEXT}
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
                {copied === '__all__' ? 'Скопировано' : 'Скопировать всё для реферата'}
              </Button>
            )}
          </div>

          {sources.length === 0 ? (
            <Card className="mt-4 max-w-2xl bg-muted/50">
              <CardContent className="pt-6 text-sm text-muted-foreground">
                По запросу релевантной литературы не найдено. Попробуйте
                сформулировать тему другими словами.
              </CardContent>
            </Card>
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
                        {copied === key ? 'Скопировано' : 'Скопировать по ГОСТ Р'}
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
