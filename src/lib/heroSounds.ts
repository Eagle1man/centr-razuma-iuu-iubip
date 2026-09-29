import type { CharacterId } from './characters'

/* ВОССТАНОВЛЕНО по списку экспортов из AdamAssistantPanel.tsx:

     playSfx, playVoice, speakHero, stopSpeaking, toggleSound, toggleVoice,
     isSoundEnabled, isVoiceEnabled, unlockSpeech

   Звук героев: короткие эффекты (Web Audio) и речь (Web Speech API). */

const SOUND_KEY = 'cr-sound-enabled'
const VOICE_KEY = 'cr-voice-enabled'

type Listener = () => void

const listeners = new Set<Listener>()

function readFlag(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback
  const stored = window.localStorage.getItem(key)
  if (stored === null) return fallback
  return stored === 'true'
}

function writeFlag(key: string, value: boolean) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, String(value))
  listeners.forEach((listener) => listener())
}

export function isSoundEnabled(): boolean {
  return readFlag(SOUND_KEY, true)
}

export function isVoiceEnabled(): boolean {
  return readFlag(VOICE_KEY, true)
}

/* Подписка на изменения настроек звука. Возвращает отписку именно как
   `() => void`: React-эффект принимает её как cleanup-функцию, а `() => boolean`
   (каким был бы `Set.delete`) в этот тип не подходит. */
export function onSoundSettingsChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function toggleSound(): boolean {
  const next = !isSoundEnabled()
  writeFlag(SOUND_KEY, next)
  return next
}

export function toggleVoice(): boolean {
  const next = !isVoiceEnabled()
  writeFlag(VOICE_KEY, next)
  if (!next) stopSpeaking()
  return next
}

let audioContext: AudioContext | null = null

/** Браузеры включают звук только после действия пользователя. */
export function unlockSpeech() {
  if (typeof window === 'undefined') return
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    audioContext = audioContext ?? new Ctor()
    if (audioContext.state === 'suspended') void audioContext.resume()
    // Пустая реплика «разогревает» очередь синтеза речи в Safari/Chrome.
    if (isVoiceEnabled() && window.speechSynthesis) {
      const warmUp = new SpeechSynthesisUtterance(' ')
      warmUp.volume = 0
      window.speechSynthesis.speak(warmUp)
    }
  } catch {
    /* звук недоступен — молча продолжаем */
  }
}

const SFX_FREQ: Record<string, number> = {
  click: 520,
  open: 660,
  correct: 780,
  wrong: 300,
}

/** Короткий эффект: одна нота с затуханием. */
export function playSfx(kind: keyof typeof SFX_FREQ | string = 'click') {
  if (!isSoundEnabled()) return
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    audioContext = audioContext ?? new Ctor()
    if (audioContext.state === 'suspended') void audioContext.resume()

    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    oscillator.frequency.value = SFX_FREQ[kind] ?? SFX_FREQ.click
    oscillator.type = 'sine'
    gain.gain.setValueAtTime(0.08, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.18)
    oscillator.connect(gain).connect(audioContext.destination)
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.2)
  } catch {
    /* звук недоступен */
  }
}

/** Короткий сигнал-«голос» героя перед репликой. */
export function playVoice(character?: CharacterId) {
  if (!character) return
  const kind = character === 'adam' ? 'open' : 'click'
  playSfx(kind)
}

/* ---------------------------------------------------------------------------
   Речь героев.

   Web Speech API не умеет SSML в Chrome и Firefox, поэтому «живость» речи
   набирается приёмами на стороне клиента:

     1) профиль голоса героя — темп, тон, пауза между фразами и список
        предпочтительных системных голосов;
     2) подготовка текста — сокращения раскрываются, пунктуация
        нормализуется, markdown и эмодзи убираются;
     3) реплика озвучивается фразами по очереди с короткой паузой и лёгкой
        вариацией тона: монотонность исчезает, а в Chrome попутно обходится
        лимит на длину одной реплики (около 15 секунд);
     4) настроение (похвала, поддержка, предупреждение) добавляет тёплые или
        серьёзные ноты.
   ------------------------------------------------------------------------- */

export type HeroMood = 'neutral' | 'praise' | 'support' | 'warn'

interface VoiceProfile {
  rate: number
  pitch: number
  volume: number
  /** Пауза между фразами, мс. */
  gap: number
  /** Предпочтительные системные голоса, по убыванию. */
  hints: string[]
}

/* ---------------------------------------------------------------------------
   ГОЛОС-БЛИЗНЕЦ.
   Кейн говорит ровно так же, как Адам, а Бани — так же, как Николь: тот же
   системный голос, тот же тембр, та же интонация и те же паузы.

   Почему не «просто похожий профиль»: если в системе всего один русский голос,
   четыре отдельных профиля всё равно дадут Адаму и Кейну один и тот же голос —
   расходиться будет только темп, и герои начнут звучать случайно по-разному.
   Схема близнеца держит обе пары одинаковыми на любой системе.

   Чтобы вернуть Кейну и Бани собственную подачу, поставьте им в TWIN_STRENGTH
   значение 1 — их профили ниже для этого уже описаны.
   --------------------------------------------------------------------------- */
const VOICE_TWIN: Partial<Record<CharacterId, CharacterId>> = {
  cain: 'adam',
  bunny: 'nicole',
}

/** Насколько подача героя отличается от подачи голоса-близнеца:
    0 — неотличимо (сейчас так у Кейна и Бани), 1 — полностью своя. */
const TWIN_STRENGTH: Record<CharacterId, number> = { adam: 1, nicole: 1, cain: 0, bunny: 0 }

const VOICE_PROFILES: Record<CharacterId, VoiceProfile> = {
  // Адам — рыцарь-наставник: ровный, спокойный, чуть ниже среднего.
  // Задаёт манеру и Кейну.
  adam: {
    rate: 0.86,
    pitch: 0.93,
    volume: 1,
    gap: 420,
    hints: [
      'Microsoft Dmitry',
      'Dmitry',
      'Microsoft Pavel',
      'Pavel',
      'Filipp',
      'Yuri',
      'Artemiy',
      'Google русский',
      'Russian',
    ],
  },
  // Николь — хранительница туризма: светлый приветливый голос.
  // Задаёт манеру и Бани.
  nicole: {
    rate: 0.89,
    pitch: 1.04,
    volume: 1,
    gap: 400,
    hints: [
      'Microsoft Svetlana',
      'Svetlana',
      'Microsoft Irina',
      'Irina',
      'Milena',
      'Alena',
      'Katya',
      'Dariya',
      'Google русский',
      'Russian',
    ],
  },
  // Кейн — чародей. Голос-близнец Адама: при TWIN_STRENGTH = 0 (сейчас так)
  // используется профиль Адама целиком, этот блок — только на запас.
  cain: {
    rate: 0.86,
    pitch: 0.84,
    volume: 1,
    gap: 230,
    hints: ['Microsoft Dmitry', 'Dmitry', 'Microsoft Pavel', 'Pavel', 'Filipp', 'Google русский', 'Russian'],
  },
  // Бани — эльф. Голос-близнец Николь: при TWIN_STRENGTH = 0 (сейчас так)
  // используется профиль Николь целиком, этот блок — только на запас.
  bunny: {
    rate: 0.97,
    pitch: 1.18,
    volume: 1,
    gap: 180,
    hints: [
      'Microsoft Svetlana',
      'Svetlana',
      'Microsoft Irina',
      'Irina',
      'Alena',
      'Katya',
      'Dariya',
      'Milena',
      'Google русский',
      'Russian',
    ],
  },
}

const NEUTRAL_PROFILE: VoiceProfile = { rate: 1, pitch: 1, volume: 1, gap: 150, hints: [] }

/* ---------------------------------------------------------------------------
   Разрешение «голоса-близнеца».

   profileFor() и pickVoice() спрашивают героя не напрямую, а его близнеца:
   поэтому Кейн и Адам получают физически один и тот же SpeechSynthesisVoice
   и одну и ту же манеру речи, а не «похожее» звучание.
   --------------------------------------------------------------------------- */

/** Кто звучит «как» этот герой: Кейн — как Адам, Бани — как Николь. */
export function voiceTwin(character?: CharacterId): CharacterId | undefined {
  if (!character) return undefined
  return VOICE_TWIN[character] ?? character
}

/** Профиль подачи: у голоса-близнеца — общий, у остальных — свой. */
function profileFor(character?: CharacterId): VoiceProfile {
  if (!character) return NEUTRAL_PROFILE
  const twin = VOICE_TWIN[character]
  if (!twin) return VOICE_PROFILES[character]

  const base = VOICE_PROFILES[twin]
  const own = VOICE_PROFILES[character]
  const k = clamp(TWIN_STRENGTH[character] ?? 0, 0, 1)
  if (k === 0) return base

  return {
    rate: base.rate + (own.rate - base.rate) * k,
    pitch: base.pitch + (own.pitch - base.pitch) * k,
    volume: base.volume,
    gap: base.gap + (own.gap - base.gap) * k,
    hints: base.hints,
  }
}

/** Поправки к профилю в зависимости от настроения героя.
    Все четыре настроения сдержанные: герои не суетятся и не повышают голос,
    а меняют только темп и паузу. */
const MOOD_TUNING: Record<HeroMood, { rate: number; pitch: number; gap: number }> = {
  neutral: { rate: 0, pitch: 0, gap: 0 },
  praise: { rate: -0.02, pitch: 0.03, gap: 40 },
  support: { rate: -0.05, pitch: -0.02, gap: 90 },
  warn: { rate: -0.05, pitch: -0.03, gap: 70 },
}

const MAX_SPEECH_LENGTH = 1200
const CHUNK_LENGTH = 110

const voiceCache = new Map<CharacterId, SpeechSynthesisVoice | null>()
let voicesListenerAttached = false

/* Ручной выбор голоса для героя (localStorage): сохранённое значение имеет
   приоритет над автоподбором. Значение — voice.name из getVoices(). */
const VOICE_PREF_KEY = 'cr-voice-pref'

export function getVoicePref(character: CharacterId | 'all'): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(`${VOICE_PREF_KEY}:${character}`) ?? ''
}

export function setVoicePref(character: CharacterId | 'all', voiceName: string) {
  if (typeof window === 'undefined') return
  if (voiceName) {
    window.localStorage.setItem(`${VOICE_PREF_KEY}:${character}`, voiceName)
  } else {
    window.localStorage.removeItem(`${VOICE_PREF_KEY}:${character}`)
  }
  voiceCache.clear()
  listeners.forEach((listener) => listener())
}

/* Регулятор скорости речи героев (localStorage `cr-voice-rate`).
   1 — штатный темп героя; 0.6 — очень медленно и вдумчиво; 1.5 — быстро.
   Умножается поверх профиля героя, поэтому ползунок одинаково управляет
   и Адамом с Кейном, и Николь с Банни. */
const RATE_KEY = 'cr-voice-rate'
const RATE_MIN = 0.6
const RATE_MAX = 1.5
const RATE_DEFAULT = 1

export function getVoiceRate(): number {
  if (typeof window === 'undefined') return RATE_DEFAULT
  const raw = window.localStorage.getItem(RATE_KEY)
  if (raw === null) return RATE_DEFAULT
  const value = Number(raw)
  return Number.isFinite(value) ? clamp(value, RATE_MIN, RATE_MAX) : RATE_DEFAULT
}

export function setVoiceRate(value: number) {
  if (typeof window === 'undefined') return
  const next = clamp(Number(value) || RATE_DEFAULT, RATE_MIN, RATE_MAX)
  window.localStorage.setItem(RATE_KEY, String(next))
  listeners.forEach((listener) => listener())
}

/** Ручной выбор голоса с учётом близнеца: личный героя, личный Адама/Николь,
    затем общий. Так пара «Кейн и Адам» всегда звучит одним голосом. */
function resolvePref(character?: CharacterId): string {
  if (!character) return getVoicePref('all')
  const own = getVoicePref(character)
  if (own) return own
  const twin = VOICE_TWIN[character]
  return (twin && getVoicePref(twin)) || getVoicePref('all')
}

/** Список русских голосов браузера (для селектора в панели). */
export function listRuVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return []
  const voices = window.speechSynthesis.getVoices()
  const russian = voices.filter((voice) => (voice.lang ?? '').toLowerCase().startsWith('ru'))
  // Лучшие (по оценке «человечности») — сверху списка.
  return russian
    .map((voice) => ({ voice, score: scoreVoice(voice, NEUTRAL_PROFILE) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.voice)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Chrome подгружает голоса асинхронно — ждём событие, но не дольше 600 мс. */
function whenVoicesReady(callback: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const synth = window.speechSynthesis
  if (synth.getVoices().length) {
    callback()
    return
  }

  let done = false
  const run = () => {
    if (done) return
    done = true
    voiceCache.clear()
    callback()
  }

  window.setTimeout(run, 600)

  if (voicesListenerAttached) return
  voicesListenerAttached = true
  try {
    synth.addEventListener('voiceschanged', run, { once: true })
  } catch {
    /* старые движки без addEventListener — хватит таймаута */
  }
}

/* Оценка «человечности» голоса. Нейронные голоса Microsoft (Online Natural),
   Google и Яндекс звучат почти как дикторы; старые SAPI-голоса («Microsoft
   Irina», «Microsoft Pavel») — машинно, поэтому получают низкий балл. */
const ROBOTIC_HINTS = ['espeak', 'compact', 'desktop', 'sapi', 'speech platform']

function scoreVoice(voice: SpeechSynthesisVoice, profile: VoiceProfile): number {
  const name = voice.name.toLowerCase()
  const lang = (voice.lang ?? '').toLowerCase()
  let score = 0

  if (lang.startsWith('ru')) score += 30
  if (name.includes('natural') || name.includes('neural') || name.includes('нейро')) score += 120
  if (name.includes('online')) score += 45
  if (name.includes('premium') || name.includes('enhanced') || name.includes('plus')) score += 40
  if (name.includes('google')) score += 55

  // Совпадение с «характером» героя: мужские и женские имена из профиля.
  profile.hints.forEach((hint, index) => {
    if (name.includes(hint.toLowerCase())) score += 60 - index * 3
  })

  for (const bad of ROBOTIC_HINTS) {
    if (name.includes(bad)) score -= 60
  }

  return score
}

function pickVoice(character?: CharacterId): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null

  // Кэш общий для пары «Кейн — Адам» и «Бани — Николь»: один и тот же герой
  // всегда отдаёт физически тот же SpeechSynthesisVoice.
  const key = voiceTwin(character)
  if (key && voiceCache.has(key)) return voiceCache.get(key) ?? null

  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  // Ручной выбор пользователя имеет высший приоритет: сначала персональный
  // голос героя (или его близнеца), затем общий («all»), затем автоподбор
  // по «человечности».
  const prefName = resolvePref(character)
  if (prefName) {
    const preferred = voices.find((voice) => voice.name === prefName)
    if (preferred) {
      if (key) voiceCache.set(key, preferred)
      return preferred
    }
  }

  const profile = profileFor(character)
  // Читаем только русскими голосами: иначе реплика пойдёт с чужим акцентом.
  const russian = voices.filter((voice) => (voice.lang ?? '').toLowerCase().startsWith('ru'))
  const pool = russian.length ? russian : voices

  let chosen: SpeechSynthesisVoice | null = null
  let best = Number.NEGATIVE_INFINITY
  for (const voice of pool) {
    const score = scoreVoice(voice, profile)
    if (score > best) {
      best = score
      chosen = voice
    }
  }

  if (key) voiceCache.set(key, chosen)
  return chosen
}

/**
 * Качество доступных голосов: 'natural' — есть нейронный «дикторский» голос,
 * 'standard' — только системный синтез (звучит машинно), 'none' — синтеза нет.
 */
export function getVoiceQuality(): 'natural' | 'standard' | 'none' {
  if (typeof window === 'undefined' || !window.speechSynthesis) return 'none'
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return 'none'

  let best = Number.NEGATIVE_INFINITY
  for (const voice of voices) {
    best = Math.max(best, scoreVoice(voice, NEUTRAL_PROFILE))
  }

  return best >= 80 ? 'natural' : 'standard'
}

/** Лёгкая «дыхательная» вариация: без неё синтез звучит механически.
    Амплитуда намеренно мала — большие скачки тона читаются как нервозность. */
function variation(index: number): { rate: number; pitch: number } {
  const wave = Math.sin(index * 1.7)
  return { rate: wave * 0.012, pitch: wave * 0.015 }
}

/* Сокращения. Раскрываем их ПОСЛЕ единиц измерения: «20 см.» к этому моменту
   уже стало «20 сантиметров», поэтому «см.» превратится в «смотри» только там,
   где оно действительно сокращение («см. выше»). Разделитель ловится группой,
   а не lookbehind: так регулярки понимает любой браузер, включая Safari до 16.4. */
const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/(^|[^\d.,])\bт\.\s*к\./gi, '$1так как'],
  [/(^|[^\d.,])\bт\.\s*е\./gi, '$1то есть'],
  [/(^|[^\d.,])\bт\.\s*д\./gi, '$1так далее'],
  [/(^|[^\d.,])\bт\.\s*п\./gi, '$1тому подобное'],
  [/(^|[^\d.,])\bи\s*т\.\s*д\./gi, '$1и так далее'],
  [/(^|[^\d.,])\bи\s*т\.\s*п\./gi, '$1и тому подобное'],
  [/(^|[^\d.,])\bнапр\./gi, '$1например'],
  [/(^|[^\d.,])\bрис\./gi, '$1рисунок'],
  [/(^|[^\d.,])\bстр\./gi, '$1страница'],
  [/(^|[^\d.,])\bсм\./gi, '$1смотри'],
  [/(^|[^\d.,])\bдр\./gi, '$1другие'],
  [/(^|[^\d.,])\bтыс\./gi, '$1тысяч'],
  [/(^|[^\d.,])\bруб\./gi, '$1рублей'],
]

/* Латиницу вслух не произносим: русский синтез читает «backslash stretch»
   как «бэк слэш стретч», а «npm» — как «эн пи эм». Оставляем только
   короткие аббревиатуры, которые читаются по-русски без запинки. */
const LATIN_KEEP = new Set([
  'ок', 'ok', 'it', 'pc', 'pdf', 'html', 'css', 'js', 'api', 'url', 'seo',
  'sms', 'ai', 'vr', 'ar', 'ux', 'ui', 'cd', 'dvd', 'usb', 'wi', 'fi', 'gps',
])

/* Символьный мусор: обратный слэш, слэш, вертикальная черта и прочее —
   источник «бэк слэш», «пайп», «стрэл вправо». Валюту, процент и градусы
   отсюда убрали: их раньше разворачиваются словами в UNITS_FIRST. */
const SYMBOL_NOISE = /[\\/|~`^_*+<>=@#§¶•·※←⇿∀⋿☀➿]/g

/* Единицы измерения. Разворачиваем ПЕРВЫМИ — иначе «20 см.» успеет
   превратиться в «20 смотри» из списка сокращений. */
const UNITS_FIRST: Array<[RegExp, string]> = [
  [/(\d)\s*°\s*C\b/gi, '$1 градусов цельсия'],
  [/(\d)\s*°\s*F\b/gi, '$1 градусов фаренгейта'],
  [/(\d)\s*%/g, '$1 процентов'],
  [/(\d)\s*₽/g, '$1 рублей'],
  [/(\d)\s*€/g, '$1 евро'],
  [/(\d)\s*\$/g, '$1 долларов'],
  [/(\d)\s*кг\b/gi, '$1 килограммов'],
  [/(\d)\s*мл\b/gi, '$1 миллилитров'],
  [/(\d)\s*мг\b/gi, '$1 миллиграммов'],
  [/(\d)\s*см\b/gi, '$1 сантиметров'],
  [/(\d)\s*мм\b/gi, '$1 миллиметров'],
  [/(\d)\s*км\b/gi, '$1 километров'],
]

/* Адресные сокращения и «хвосты» знаков — после сокращений и латиницы. */
const UNITS_LAST: Array<[RegExp, string]> = [
  [/№\s*(\d+)/g, 'номер $1'],
  [/\bкв\.\s*/gi, 'квартира '],
  [/\bд\.\s*(\d)/gi, 'дом $1'],
  [/[$£€¥₽]/g, ' '],
]

/**
 * Текст, который звучит ровно и внятно.
 *
 * Порядок важен: сначала выбрасываем всё служебное (код, ссылки, адреса,
 * картинки), затем убираем эмодзи и латиницу, потом раскрываем единицы
 * измерения и только после этого — сокращения.
 */
function humanize(text: string): string {
  let result = text
    // 1. Разметка и код — целиком, вместе с содержимым.
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')   // картинки
    .replace(/\[([^\]]*)]\(([^)]*)\)/g, '$1') // ссылки: оставляем подпись
    .replace(/\[([^\]]*)]/g, '$1')
    .replace(/[*_#>]+/g, ' ')
    // 2. Адреса, почта и пути — вслух они только мешают.
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, ' ')
    .replace(/[a-z]:\\[^\s]*/gi, ' ')
    // Единицы «в час» и «в секунду» — до чистки путей, иначе слэш их съест.
    .replace(/(\d)\s*км\s*\/\s*ч/gi, '$1 километров в час')
    .replace(/(\d)\s*м\s*\/\s*с/gi, '$1 метров в секунду')
    .replace(/(^|\s)\S*[\\/]\S*/g, '$1 ')
    // 3. Эмодзи, стрелки, галочки, сердечки.
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, ' ')
    // 4. Латиница, кроме коротких аббревиатур.
    .replace(/[A-Za-z][A-Za-z0-9'’-]*/g, (word) => (LATIN_KEEP.has(word.toLowerCase()) ? word : ' '))
    // 5. Символьный мусор.
    .replace(SYMBOL_NOISE, ' ')
    // 6. Знаки, которые читаются паузой.
    .replace(/&/g, ' и ')
    .replace(/\s*[—–]\s*/g, ' — ')
    .replace(/\s*;\s*/g, '. ')
    .replace(/\s*\.\s*\./g, '. ')
    .replace(/\s+/g, ' ')
    .trim()

  for (const [pattern, replacement] of UNITS_FIRST) {
    result = result.replace(pattern, replacement)
  }

  for (const [pattern, replacement] of ABBREVIATIONS) {
    result = result.replace(pattern, replacement)
  }

  for (const [pattern, replacement] of UNITS_LAST) {
    result = result.replace(pattern, replacement)
  }

  // Движки «проглатывают» знаки без пробела после них. Дробь «1.5» не трогаем:
  // для синтеза это одно число, а не конец предложения. Осиротевшие знаки
  // (остались после вырезанной ссылки или пути) убираем совсем — одиночная
  // точка вслух звучит как лишняя пауза.
  return result
    .replace(/(^|\s)[.,;:!?…]+(?=\s|$)/g, '$1')
    .replace(/(^|[^\d])([.!?…,])(?=[^\s.!?…,])/g, '$1$2 ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Разбиение на фразы: точка внутри числа («1.5») концом фразы не считается. */
function splitSentences(text: string): string[] {
  const sentences: string[] = []
  let buffer = ''

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    buffer += char

    const isEnd = char === '.' || char === '!' || char === '?' || char === '…'
    if (!isEnd) continue

    const next = text[i + 1]
    if (next && !/\s/.test(next)) continue

    sentences.push(buffer.trim())
    buffer = ''
  }

  if (buffer.trim()) sentences.push(buffer.trim())
  return sentences.filter(Boolean)
}

/** Фраза делится на «дыхательные» такты по запятым, тире и двоеточиям. */
function splitClauses(sentence: string): string[] {
  const clauses: string[] = []
  let buffer = ''

  for (let i = 0; i < sentence.length; i += 1) {
    const char = sentence[i]
    buffer += char

    const isBreak = char === ',' || char === ';' || char === ':' || char === '—'
    if (!isBreak) continue

    const next = sentence[i + 1]
    if (next && !/\s/.test(next)) continue

    clauses.push(buffer.trim())
    buffer = ''
  }

  if (buffer.trim()) clauses.push(buffer.trim())
  return clauses.filter(Boolean)
}

interface SpeechChunk {
  text: string
  /** Пауза после такта, мс. */
  pause: number
}

/**
 * Речь собирается из коротких тактов: закончился такт на запятой — пауза
 * короче, закончилось предложение — пауза длиннее. Именно так дышат дикторы,
 * а синтез перестаёт «тараторить» одной непрерывной строкой.
 */
function buildChunks(text: string, baseGap: number): SpeechChunk[] {
  const chunks: SpeechChunk[] = []
  let current = ''

  const flush = (pause: number) => {
    if (!current) return
    chunks.push({ text: current, pause })
    current = ''
  }

  for (const sentence of splitSentences(text)) {
    for (const clause of splitClauses(sentence)) {
      const candidate = current ? `${current} ${clause}` : clause
      if (candidate.length > CHUNK_LENGTH && current) {
        flush(Math.round(baseGap * 0.6))
        current = clause
      } else {
        current = candidate
      }
    }
    flush(baseGap)
  }

  flush(baseGap)
  return chunks
}

let speakToken = 0
let pendingTimer: number | null = null

function resetSpeech() {
  speakToken += 1
  if (pendingTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(pendingTimer)
  }
  pendingTimer = null
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* игнорируем */
  }
}

export interface SpeakOptions {
  character?: CharacterId
  mood?: HeroMood
  /**
   * Множитель темпа поверх профиля героя. Если не передан, берётся общий
   * регулятор из панели героя (localStorage `cr-voice-rate`). Страница чтения
   * передаёт своё значение — оно всегда выигрывает.
   */
  rateScale?: number
  volume?: number
  /** Вызывается, когда прозвучала последняя фраза. */
  onEnd?: () => void
}

/**
 * Озвучить текст «по-человечески»: фразами, с паузами, лёгкой вариацией тона
 * и поправкой на настроение (похвала, поддержка, предупреждение).
 */
export function speakText(text: string, options: SpeakOptions = {}) {
  if (!isVoiceEnabled()) return
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) return

  const { character, mood = 'neutral', volume, onEnd } = options
  const rateScale = options.rateScale ?? getVoiceRate()
  const synth = window.speechSynthesis
  // Профиль берём у голоса-близнеца: Кейн говорит манерой Адама,
  // Бани — манерой Николь (см. VOICE_TWIN).
  const profile = profileFor(character)
  const tuning = MOOD_TUNING[mood]
  const chunks = buildChunks(humanize(text.slice(0, MAX_SPEECH_LENGTH)), profile.gap + tuning.gap)
  if (!chunks.length) return

  resetSpeech()
  const token = speakToken

  const speakChunk = (index: number) => {
    if (token !== speakToken) return
    if (index >= chunks.length) {
      onEnd?.()
      return
    }

    const utterance = new SpeechSynthesisUtterance(chunks[index].text)
    const voice = pickVoice(character)
    if (voice) utterance.voice = voice
    utterance.lang = voice?.lang ?? 'ru-RU'

    const drift = variation(index)
    utterance.rate = clamp(profile.rate * rateScale + tuning.rate + drift.rate, 0.6, 2)
    utterance.pitch = clamp(profile.pitch + tuning.pitch + drift.pitch, 0.5, 1.8)
    utterance.volume = clamp(volume ?? profile.volume, 0, 1)

    const proceed = () => {
      if (token !== speakToken) return
      const gap = Math.max(60, chunks[index].pause)
      pendingTimer = window.setTimeout(() => speakChunk(index + 1), gap)
    }
    utterance.onend = proceed
    utterance.onerror = proceed

    try {
      synth.speak(utterance)
    } catch {
      /* синтез недоступен */
    }
  }

  // Если голоса ещё не загрузились, первая фраза подождёт их появления.
  // Небольшая задержка нужна ещё и потому, что Chrome иногда «проглатывает»
  // реплику, начатую сразу после cancel().
  whenVoicesReady(() => {
    pendingTimer = window.setTimeout(() => speakChunk(0), 60)
  })
}

/** Озвучить реплику героя с учётом его характера и настроения. */
export function speakHero(text: string, character?: CharacterId, mood: HeroMood = 'neutral') {
  speakText(text, { character, mood })
}

export function stopSpeaking() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  resetSpeech()
}