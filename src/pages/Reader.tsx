import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Minus, Pause, Play, Plus, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import EmptyState from '@/components/EmptyState'
import { getBookById } from '@/lib/libraryData'
import { useCatalog } from '@/hooks/useCatalog'
import { usePageMeta } from '@/hooks/usePageMeta'
import { speakText, stopSpeaking } from '@/lib/heroSounds'

/* ВОССТАНОВЛЕНО: страница не дошла в дампе; маршрут /read/:id, layout bare
   (см. routes.tsx). Настройки скорости речи и громкости — по интерфейсу,
   видному на скриншоте проекта. */

export default function Reader() {
  const { id = '' } = useParams()
  const { books: catalogBooks } = useCatalog()
  const book = catalogBooks.find((item) => item.id === id) ?? getBookById(id)

  const [fontSize, setFontSize] = useState(17)
  const [rate, setRate] = useState(1)
  const [volume, setVolume] = useState(1)
  const [playing, setPlaying] = useState(false)

  usePageMeta({ title: book ? `Чтение: ${book.title}` : 'Чтение' })

  const paragraphs = useMemo(() => (book ? book.content.split('\n\n') : []), [book])

  useEffect(() => () => stopSpeaking(), [])

  if (!book) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          title="Текст не найден"
          description="Издание недоступно — вернитесь в каталог и выберите другое."
          actionLabel="В каталог"
          onAction={() => {
            window.location.href = '/'
          }}
        />
      </div>
    )
  }

  const toggleSpeech = () => {
    if (playing) {
      stopSpeaking()
      setPlaying(false)
      return
    }

    const text = paragraphs.join(' ')

    // Настройки страницы (темп, громкость) передаём в общий движок озвучки:
    // он сам делит текст на фразы, держит паузы и подбирает голос.
    speakText(text, {
      character: 'adam',
      rateScale: rate,
      volume,
      onEnd: () => setPlaying(false),
    })
    setPlaying(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/book/${book.id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              К книге
            </Link>
          </Button>

          <span className="text-sm text-muted-foreground">
            {book.cover} {book.title}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border px-2 py-1">
              <button
                type="button"
                aria-label="Уменьшить шрифт"
                onClick={() => setFontSize((value) => Math.max(14, value - 1))}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-xs text-muted-foreground">{fontSize}</span>
              <button
                type="button"
                aria-label="Увеличить шрифт"
                onClick={() => setFontSize((value) => Math.min(26, value + 1))}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <label className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              Скорость речи
              <input
                type="range"
                min={0.6}
                max={1.6}
                step={0.1}
                value={rate}
                onChange={(event) => setRate(Number(event.target.value))}
                className="w-24"
              />
            </label>

            <label className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <Volume2 className="h-4 w-4" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                className="w-20"
              />
            </label>

            <Button size="sm" onClick={toggleSpeech}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span className="ml-2">{playing ? 'Пауза' : 'Слушать'}</span>
            </Button>
          </div>
        </div>
        <Progress value={playing ? 60 : 0} className="h-1 rounded-none" />
      </header>

      <article className="mx-auto max-w-3xl px-4 py-12">
        {paragraphs.map((block, index) =>
          block.startsWith('##') ? (
            <h2
              key={index}
              className="mt-8 mb-4 font-semibold text-foreground first:mt-0"
              style={{ fontSize: fontSize + 6 }}
            >
              {block.replace(/^##\s*/, '')}
            </h2>
          ) : (
            <p
              key={index}
              className="mb-4 leading-relaxed text-muted-foreground"
              style={{ fontSize }}
            >
              {block}
            </p>
          )
        )}

        <div className="mt-12 flex justify-between border-t pt-6">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/book/${book.id}`}>Описание издания</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">В каталог</Link>
          </Button>
        </div>
      </article>
    </div>
  )
}