import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Save } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CATEGORIES, type CategoryId } from '@/lib/characters'
import { getBookById } from '@/lib/api'
import { usePageMeta } from '@/hooks/usePageMeta'

/* Маршруты /editor и /editor/:id из routes.tsx (оба под ProtectedRoute).
   Источник правды — SQLite нового бэкенда: POST /api/books (создать),
   PATCH /api/books/{id} (обновить). Формат полей — snake_case из
   backend/books_api.py (BookCreate/BookUpdate). Base URL — как в
   src/lib/api.ts: window.__APP_CONFIG__.libraryApi, default '/api'.
   Токен X-Ingest-Token — из конфига или поля формы, в код не хардкодим. */

/** Строковая категория фронта -> числовой category_id бэкенда. */
const CATEGORY_TO_ID: Record<CategoryId, number> = {
  tourism: 1,
  law: 2,
  economics: 3,
  pharmacy: 4,
}

const ID_TO_CATEGORY: Record<number, CategoryId> = {
  1: 'tourism',
  2: 'law',
  3: 'economics',
  4: 'pharmacy',
}

function getLibraryBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const raw = (window.__APP_CONFIG__ as { libraryApi?: string } | undefined)?.libraryApi
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim().replace(/\/+$/, '')
    }
  }
  return '/api'
}

/** Токен из конфига (не хардкод): читаем при каждом сохранении. */
function getConfiguredToken(): string {
  if (typeof window === 'undefined') return ''
  const raw = (window.__APP_CONFIG__ as { ingestToken?: string } | undefined)?.ingestToken
  return typeof raw === 'string' ? raw.trim() : ''
}

interface BookPayload {
  title: string
  author: string
  year: number
  category_id: number
  annotation: string
  content: string
}

async function saveBook(
  id: string | undefined,
  payload: BookPayload,
  token: string,
): Promise<{ ok: boolean; status: number; bookId?: string }> {
  const base = getLibraryBaseUrl()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (token) headers['X-Ingest-Token'] = token
  const url = id ? `${base}/books/${encodeURIComponent(id)}` : `${base}/books`
  let res: Response
  try {
    res = await fetch(url, {
      method: id ? 'PATCH' : 'POST',
      headers,
      body: JSON.stringify(payload),
    })
  } catch {
    return { ok: false, status: 0 }
  }
  if (!res.ok) return { ok: false, status: res.status }
  let bookId = id
  try {
    const data = (await res.json()) as { id?: string | number }
    if (data && data.id !== undefined) bookId = String(data.id)
  } catch {
    /* id уже есть из ответа/параметра */
  }
  return { ok: true, status: res.status, bookId }
}

const schema = z.object({
  title: z.string().min(3, 'Название не короче 3 символов'),
  author: z.string().min(2, 'Укажите автора'),
  year: z.coerce
    .number()
    .int('Год — целое число')
    .min(1900, 'Слишком ранний год')
    .max(new Date().getFullYear() + 1, 'Год ещё не наступил'),
  categoryId: z.enum(['tourism', 'law', 'economics', 'pharmacy']),
  annotation: z.string().min(20, 'Аннотация не короче 20 символов'),
  content: z.string().min(50, 'Текст издания не короче 50 символов'),
  ingestToken: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function PostEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loadingBook, setLoadingBook] = useState(isEdit)

  usePageMeta({
    title: isEdit ? 'Редактирование издания' : 'Добавление издания',
    description: 'Форма публикации учебного издания в электронной библиотеке.',
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      author: 'Центр разума ЮУ ИУБиП',
      year: new Date().getFullYear(),
      categoryId: 'tourism',
      annotation: '',
      content: '',
      ingestToken: getConfiguredToken(),
    },
  })

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoadingBook(true)
    getBookById(id)
      .then((book) => {
        if (cancelled || !book) return
        form.reset({
          title: book.title,
          author: book.author,
          year: book.year,
          categoryId: (ID_TO_CATEGORY[Number(book.categoryId)] ?? book.categoryId) as FormValues['categoryId'],
          annotation: book.annotation,
          content: book.content,
          ingestToken: getConfiguredToken(),
        })
      })
      .finally(() => {
        if (!cancelled) setLoadingBook(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, form])

  const onSubmit = async (values: FormValues) => {
    const token = values.ingestToken?.trim() || getConfiguredToken()
    const payload: BookPayload = {
      title: values.title,
      author: values.author,
      year: values.year,
      category_id: CATEGORY_TO_ID[values.categoryId],
      annotation: values.annotation,
      content: values.content,
    }
    const result = await saveBook(id, payload, token)
    if (result.ok) {
      toast.success(isEdit ? 'Издание обновлено' : 'Издание добавлено в каталог')
      navigate(isEdit && result.bookId ? `/book/${result.bookId}` : '/')
      return
    }
    if (result.status === 0) {
      toast.error('Бэкенд недоступен: проверьте, что API запущено')
    } else if (result.status === 401) {
      toast.error('Неверный X-Ingest-Token: проверьте токен в поле формы')
    } else if (result.status === 404 && isEdit) {
      toast.error('Издание не найдено на бэкенде')
    } else {
      toast.error(`Не удалось сохранить (HTTP ${result.status})`)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link to="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          В каталог
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? 'Редактирование издания' : 'Новое издание'}</CardTitle>
          <CardDescription>
            Заполните карточку: название, автор, раздел каталога, аннотация и текст.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название</FormLabel>
                    <FormControl>
                      <Input placeholder="Например: Основы права" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-6 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="author"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Автор</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Год издания</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="numeric" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Раздел каталога</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите раздел" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.emoji} {category.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Раздел определяет героя-ассистента, который будет объяснять тему.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="annotation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Аннотация</FormLabel>
                    <FormControl>
                      <Textarea
                        className="min-h-[96px]"
                        placeholder="О чём издание и кому оно будет полезно"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Текст издания</FormLabel>
                    <FormControl>
                      <Textarea
                        className="min-h-[240px] font-mono text-sm"
                        placeholder={'## Заголовок раздела\n\nТекст абзаца…'}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Поддерживается простая разметка: строка, начинающаяся с «##», становится
                      заголовком, пустая строка разделяет абзацы.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ingestToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Токен публикации</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="off"
                        placeholder="X-Ingest-Token (по умолчанию из конфига)"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Заголовок X-Ingest-Token для записи в каталог. Подставляется из
                      конфигурации сайта, при необходимости введите вручную.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting || loadingBook}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isEdit ? 'Сохранить изменения' : 'Добавить в каталог'}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link to="/">Отмена</Link>
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
