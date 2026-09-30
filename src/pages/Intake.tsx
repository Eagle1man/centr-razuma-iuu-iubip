import * as React from 'react'
import { toast } from 'sonner'
import { Download, FileSpreadsheet, Plus, RefreshCw, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { usePageMeta } from '@/hooks/usePageMeta'
import {
  createBookManual,
  downloadImportTemplate,
  fetchImportStatus,
  listAcceptedBooks,
  uploadImportFile,
  type AcceptedBook,
  type ImportStatus,
} from '@/lib/booksIntake'

const ACCEPT = '.xlsx,.xls,.csv'

function isAcceptedName(name: string): boolean {
  return /\.(xlsx|xls|csv)$/i.test(name)
}

export default function Intake() {
  usePageMeta({
    title: 'Приём книг',
    description: 'Импорт каталога из Excel, шаблон, статус индексации и ручной ввод книги.',
  })

  const [file, setFile] = React.useState<File | null>(null)
  const [dragOver, setDragOver] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [status, setStatus] = React.useState<ImportStatus | null>(null)
  const [statusLoading, setStatusLoading] = React.useState(false)
  const [accepted, setAccepted] = React.useState<AcceptedBook[]>([])
  const [acceptedNote, setAcceptedNote] = React.useState(false)
  const [manualSaving, setManualSaving] = React.useState(false)
  const [manual, setManual] = React.useState({ title: '', author: '', year: '', isbn: '', url: '', ebbs: '', annotation: '' })
  const inputRef = React.useRef<HTMLInputElement>(null)

  const refreshStatus = React.useCallback(async () => {
    setStatusLoading(true)
    try {
      const s = await fetchImportStatus()
      if (s) setStatus(s)
      else toast.error('Статус индексации недоступен: бэкенд не отвечает')
    } finally {
      setStatusLoading(false)
    }
  }, [])

  const refreshAccepted = React.useCallback(async () => {
    const list = await listAcceptedBooks(20)
    if (list) {
      setAccepted(list)
      setAcceptedNote(false)
    } else {
      setAccepted([])
      setAcceptedNote(true)
    }
  }, [])

  React.useEffect(() => {
    void refreshStatus()
    void refreshAccepted()
  }, [refreshStatus, refreshAccepted])

  /* Опрос статуса после загрузки файла: бэкенд считает импорт фоновой задачей. */
  React.useEffect(() => {
    if (!uploading && status?.state !== 'running') return
    const t = window.setInterval(() => {
      void (async () => {
        const s = await fetchImportStatus()
        if (s) {
          setStatus(s)
          if (s.state !== 'running') {
            window.clearInterval(t)
            setUploading(false)
            void refreshAccepted()
            if (s.state === 'done') toast.success(`Импорт завершён: принято ${s.imported} из ${s.total}`)
            else if (s.state === 'error') toast.error(s.error || 'Ошибка импорта')
          }
        }
      })()
    }, 2000)
    return () => window.clearInterval(t)
  }, [uploading, status?.state, refreshAccepted])

  const pickFile = (f: File | undefined | null) => {
    if (!f) return
    if (!isAcceptedName(f.name)) {
      toast.error('Нужен файл .xlsx / .xls / .csv')
      return
    }
    setFile(f)
  }

  const onUpload = async () => {
    if (!file) {
      toast.error('Сначала выберите файл')
      return
    }
    setUploading(true)
    const res = await uploadImportFile(file)
    if (!res) {
      setUploading(false)
      toast.error('Бэкенд недоступен: файл не отправлен (сборка Pages не затронута)')
      return
    }
    toast.success('Файл принят бэкендом, следим за статусом…')
    await refreshStatus()
  }

  const onTemplate = async () => {
    const ok = await downloadImportTemplate()
    if (ok) toast.success('Шаблон скачан')
    else toast.error('Шаблон недоступен: бэкенд не отвечает')
  }

  const onManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (manual.title.trim().length < 3) {
      toast.error('Укажите название (от 3 символов)')
      return
    }
    setManualSaving(true)
    try {
      const year = manual.year.trim() === '' ? null : Number.parseInt(manual.year, 10)
      const created = await createBookManual({
        title: manual.title.trim(),
        author: manual.author.trim(),
        year: Number.isFinite(year) ? year : null,
        isbn: manual.isbn.trim(),
        url: manual.url.trim(),
        ebbs: manual.ebbs.trim(),
        annotation: manual.annotation.trim(),
      })
      if (!created) {
        toast.error('Не удалось создать книгу: бэкенд не отвечает')
        return
      }
      toast.success('Книга добавлена')
      setAccepted((prev) => [created, ...prev].slice(0, 20))
      setManual({ title: '', author: '', year: '', isbn: '', url: '', ebbs: '', annotation: '' })
    } finally {
      setManualSaving(false)
    }
  }

  const progress = status && status.total > 0 ? Math.min(100, Math.round((status.imported / status.total) * 100)) : 0

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Приём книг</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Excel-импорт каталога, отчёт приёма, шаблон, статус индексации и ручной ввод.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Импорт из Excel</CardTitle>
            <CardDescription>Перетащите файл .xlsx / .xls / .csv или выберите вручную.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              aria-label="Зона загрузки файла каталога"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                pickFile(e.dataTransfer.files?.[0])
              }}
              className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                dragOver ? 'border-primary bg-accent' : 'border-input bg-muted/30'
              }`}
            >
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">{file ? file.name : 'Перетащите файл сюда или нажмите для выбора'}</p>
              <p className="text-xs text-muted-foreground">Форматы: .xlsx, .xls, .csv</p>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onUpload} disabled={!file || uploading}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {uploading ? 'Загружаем…' : 'Отправить в импорт'}
              </Button>
              <Button variant="outline" onClick={onTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Скачать шаблон
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Статус индексации</CardTitle>
            <CardDescription>Бэкенд считает импорт фоновой задачей; FAISS-переиндексация — заглушка.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {status ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Состояние</span>
                  <span className="font-medium">{status.state}</span>
                </div>
                <Progress value={progress} />
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-muted-foreground">Принято</dt><dd className="font-medium">{status.imported}</dd></div>
                  <div><dt className="text-muted-foreground">Всего строк</dt><dd className="font-medium">{status.total}</dd></div>
                  <div className="col-span-2"><dt className="text-muted-foreground">Файл</dt><dd className="font-medium">{status.filename || '—'}</dd></div>
                </dl>
                {status.error ? <p className="text-sm text-destructive">Ошибка по строкам/файлу: {status.error}</p> : null}
                {status.detail ? <p className="text-xs text-muted-foreground">{status.detail}</p> : null}
                <p className="text-xs text-muted-foreground">
                  Отчёт бэкенда агрегатный (принято/всего/ошибка); построчных «дубли/ошибки» API не возвращает.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Статус пока недоступен — бэкенд не отвечает. Повторите позже.</p>
            )}
            <Button variant="outline" size="sm" onClick={() => void refreshStatus()} disabled={statusLoading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {statusLoading ? 'Обновляем…' : 'Обновить статус'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ручной ввод книги</CardTitle>
          <CardDescription>POST /api/books: одна карточка без Excel-файла.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onManualSubmit}>
            <div className="space-y-2">
              <Label htmlFor="intake-title">Название *</Label>
              <Input id="intake-title" value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} placeholder="Основы права" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="intake-author">Автор</Label>
              <Input id="intake-author" value={manual.author} onChange={(e) => setManual({ ...manual, author: e.target.value })} placeholder="Иванов И.И." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="intake-year">Год</Label>
              <Input id="intake-year" inputMode="numeric" value={manual.year} onChange={(e) => setManual({ ...manual, year: e.target.value })} placeholder="2024" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="intake-isbn">ISBN</Label>
              <Input id="intake-isbn" value={manual.isbn} onChange={(e) => setManual({ ...manual, isbn: e.target.value })} placeholder="978-5-…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="intake-url">Ссылка (ЭБС)</Label>
              <Input id="intake-url" value={manual.url} onChange={(e) => setManual({ ...manual, url: e.target.value })} placeholder="https://…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="intake-ebbs">ЭБС</Label>
              <Input id="intake-ebbs" value={manual.ebbs} onChange={(e) => setManual({ ...manual, ebbs: e.target.value })} placeholder="Лань" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="intake-annotation">Аннотация</Label>
              <Textarea id="intake-annotation" className="min-h-[96px]" value={manual.annotation} onChange={(e) => setManual({ ...manual, annotation: e.target.value })} placeholder="Краткое описание издания" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={manualSaving}>
                <Plus className="mr-2 h-4 w-4" />
                {manualSaving ? 'Сохраняем…' : 'Добавить книгу'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Принятые книги</CardTitle>
          <CardDescription>Последние записи каталога, принятые через импорт.</CardDescription>
        </CardHeader>
        <CardContent>
          {accepted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {acceptedNote ? 'Каталог недоступен без бэкенда — таблица пуста, сборка Pages работает.' : 'Пока пусто: загрузите Excel или добавьте книгу вручную.'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {accepted.map((b) => (
                <li key={String(b.id)} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {b.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[b.author, b.year ? String(b.year) : ''].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
