import { useEffect, useState, type ComponentType } from 'react';
import {
  AudioLines,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Coins,
  Compass,
  FlaskConical,
  ListChecks,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Swords,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Button } from './ui/button';
import {
  getVoicePref,
  getVoiceRate,
  isSoundEnabled,
  isVoiceEnabled,
  listRuVoices,
  onSoundSettingsChange,
  playSfx,
  playVoice,
  setVoicePref,
  setVoiceRate,
  speakHero,
  stopSpeaking,
  toggleSound,
  toggleVoice,
  unlockSpeech,
} from '../lib/heroSounds';
import { ADAM_GREETING, getAdamKnowledge } from '../lib/adamKnowledge';
import { askHero } from '../lib/heroChat';
import type { EbsSource } from '../lib/searchApi';
import { CHARACTERS, getCharacterByCategory, type CharacterId } from '../lib/characters';
import { QUIZ_BANKS } from '../lib/quizBanks';
import CharacterAvatar, { AdamFigure } from './CharacterAvatar';
import CharacterQuiz from './CharacterQuiz';

/* ============================================================
   Герои-ассистенты «Центра разума». Разметка и поведение перенесены
   дословно из боевой сборки Wuna (dump/figure-adam-helmet.txt, xC/bC):
   модальное окно с подложкой, шапка с аватаром героя и переключателями
   звука/голоса, вкладки «Объяснение» / «Тест», выбор проводника,
   пошаговый разбор со «Назад/Дальше/Итог», совет героя, список книг
   раздела и переход к тесту.
   ============================================================ */

/* Иконки героев: в бандле это ссылки на lucide-компоненты (поле icon),
   в минифицированном коде их имена не сохранились — подобраны по смыслу. */
const HERO_ICONS: Record<CharacterId, ComponentType<{ className?: string }>> = {
  adam: Swords,
  nicole: Compass,
  cain: FlaskConical,
  bunny: Coins,
};

const PANEL_TABS = [
  { id: 'explain' as const, label: 'Объяснение', icon: BookOpen },
  { id: 'ask' as const, label: 'Спросить', icon: MessageCircle },
  { id: 'quiz' as const, label: 'Тест', icon: ListChecks },
];

/** Реплика с эффектом печатной машинки */
function HeroSpeech({ text, speed = 18, voice }: { text: string; speed?: number; voice?: CharacterId }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    playVoice(voice);
    speakHero(text, voice);
    if (!text) return;
    const id = setInterval(() => {
      setShown((prev) => (prev >= text.length ? (clearInterval(id), prev) : prev + 2));
    }, speed);
    return () => {
      clearInterval(id);
      stopSpeaking();
    };
  }, [text, speed, voice]);
  return (
    <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
      {text.slice(0, shown)}
      <span className="adam-caret" aria-hidden="true">▍</span>
    </p>
  );
}

/** Плавающая кнопка вызова героев — видна на всех страницах */
export function AdamLauncher({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="adam-launcher fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2.5 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:shadow-xl"
      aria-label="Открыть героев-ассистентов"
    >
      <AdamFigure size={40} />
      <span className="hidden sm:block text-sm font-semibold text-foreground">Спросить Адама</span>
    </button>
  );
}

/** Панель героя — модальное окно поверх страницы. */
export function AdamPanel({
  onClose,
  initialCategory,
}: {
  onClose: () => void;
  initialCategory?: string;
}) {
  const [activeId, setActiveId] = useState<CharacterId | null>(null);
  const [tab, setTab] = useState<'explain' | 'ask' | 'quiz'>('explain');
  const [step, setStep] = useState(0);
  const [sound, setSound] = useState(isSoundEnabled());
  const [voice, setVoice] = useState(isVoiceEnabled());
  const [voicesList, setVoicesList] = useState<SpeechSynthesisVoice[]>([]);
  const [voicePref, setVoicePrefState] = useState(getVoicePref('all'));
  const [voiceRate, setVoiceRateState] = useState(getVoiceRate());

  /* Свободный вопрос герою (T-1035): ответ по реальным книгам фонда ЭБС. */
  const [heroQuestion, setHeroQuestion] = useState('');
  const [heroThinking, setHeroThinking] = useState(false);
  const [heroAnswer, setHeroAnswer] = useState<string | null>(null);
  const [heroSources, setHeroSources] = useState<EbsSource[]>([]);
  const [heroFailed, setHeroFailed] = useState(false);

  /* Список голосов Chrome отдаёт асинхронно — проверяем сразу и по событию
     voiceschanged. */
  useEffect(() => {
    const check = () => {
      setVoicesList(listRuVoices());
    };
    check();
    const timer = window.setTimeout(check, 900);
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    synth?.addEventListener?.('voiceschanged', check);
    return () => {
      window.clearTimeout(timer);
      synth?.removeEventListener?.('voiceschanged', check);
    };
  }, []);

  /* Регулятор темпа общий для всех героев и хранится в localStorage,
     поэтому подтягиваем его и при изменении настроек из другой вкладки. */
  useEffect(() => {
    return onSoundSettingsChange(() => setVoiceRateState(getVoiceRate()));
  }, []);

  /* Открытие со страницы издания сразу выбирает героя раздела — как в бандле. */
  useEffect(() => {
    if (!initialCategory) return;
    const fromCategory = getCharacterByCategory(initialCategory);
    if (fromCategory) setActiveId(fromCategory.id);
  }, [initialCategory]);

  const character = CHARACTERS.find((item) => item.id === activeId) ?? null;
  const knowledge = character ? getAdamKnowledge(character.categoryId) : null;
  const atEnd = knowledge ? step >= knowledge.steps.length : false;
  const HeroIcon = character ? HERO_ICONS[character.id] : HERO_ICONS.adam;
  const quizIntro = character ? QUIZ_BANKS[character.categoryId]?.intro ?? '' : '';

  const selectCharacter = (id: CharacterId) => {
    playSfx('click');
    playVoice(id);
    setActiveId(id);
    setTab('explain');
    setStep(0);
    setHeroQuestion('');
    setHeroAnswer(null);
    setHeroSources([]);
    setHeroFailed(false);
  };

  /* Вопрос -> /ask-books (реальные источники) -> озвучка HeroSpeech. */
  const askTheHero = async () => {
    const q = heroQuestion.trim();
    if (!q || heroThinking) return;
    unlockSpeech();
    setHeroThinking(true);
    setHeroFailed(false);
    setHeroAnswer(null);
    setHeroSources([]);
    const result = await askHero(q, character?.categoryId);
    setHeroThinking(false);
    if (result === null) {
      setHeroFailed(true);
      return;
    }
    setHeroAnswer(result.answer);
    setHeroSources(result.sources);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Герои-ассистенты Центра разума"
    >
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl animate-adam-enter overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 bg-background">
          {character ? (
            <CharacterAvatar id={character.id} size={44} talking={tab === 'explain'} />
          ) : (
            <AdamFigure size={44} />
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground leading-tight">
              {character ? character.name : 'Герои-ассистенты'}
            </p>

            <p className="text-xs text-muted-foreground truncate">
              {character ? character.role : 'Выбери проводника по разделу библиотеки'}
            </p>
          </div>

          <span className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => setSound(toggleSound())}
              title={sound ? 'Звуки интерфейса: включены' : 'Звуки интерфейса: выключены'}
              aria-label={sound ? 'Выключить звуки интерфейса' : 'Включить звуки интерфейса'}
              className={`rounded-full p-2 transition-colors hover:bg-muted hover:text-foreground ${sound ? 'text-primary' : 'text-muted-foreground/60'}`}
            >
              <Volume2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setVoice(toggleVoice());
                stopSpeaking();
              }}
              title={voice ? 'Голоса героев: включены' : 'Голоса героев: выключены'}
              aria-label={voice ? 'Выключить голос героев' : 'Включить голос героев'}
              className={`rounded-full p-2 transition-colors hover:bg-muted hover:text-foreground ${voice ? 'text-primary' : 'text-muted-foreground/60'}`}
            >
              {voice ? <AudioLines className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>
          </span>
        </div>

        {character && (
          <div className="flex gap-1 px-4 pt-3" role="tablist">
            {PANEL_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => {
                  playSfx('click');
                  setTab(item.id);
                }}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${tab === item.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </div>
        )}

        {voice && (
          <div className="mx-4 mt-3 space-y-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
            {voicesList.length > 1 ? (
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="shrink-0">Голос героев:</span>

                <select
                  value={voicePref}
                  onChange={(event) => {
                    const next = event.target.value;
                    setVoicePref('all', next);
                    setVoicePrefState(next);
                    playSfx('click');
                    if (next) {
                      stopSpeaking();
                      window.setTimeout(() => speakHero('Так звучит новый голос.', undefined), 80);
                    }
                  }}
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground"
                >
                  <option value="">Авто — самый человечный</option>
                  {voicesList.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name.replace(/^Microsoft |^Google /, '')}
                      {/natural|neural|нейро/i.test(item.name) ? ' ★' : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              voicesList.length === 1 && (
                <p className="text-[11px] leading-snug text-muted-foreground">
                  В системе всего один русский голос — {voicesList[0].name}.
                </p>
              )
            )}

            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="shrink-0">Скорость речи:</span>

              <input
                type="range"
                min={0.6}
                max={1.5}
                step={0.05}
                value={voiceRate}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setVoiceRate(next);
                  setVoiceRateState(next);
                }}
                aria-label="Скорость речи героев"
                className="min-w-0 flex-1 accent-primary"
              />

              <span className="w-9 shrink-0 text-right tabular-nums text-foreground">
                {voiceRate.toFixed(2).replace('.', ',')}×
              </span>
            </label>
          </div>
        )}

        <div className="max-h-[65vh] overflow-y-auto px-4 py-4">
          {!character && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <AdamFigure size={40} talking />

                <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 flex-1">
                  <HeroSpeech text={ADAM_GREETING} voice="adam" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CHARACTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectCharacter(item.id)}
                    className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
                  >
                    <CharacterAvatar id={item.id} size={48} />

                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-foreground">
                        {item.name} · {item.role}
                      </span>

                      <span className="mt-0.5 block text-xs text-muted-foreground leading-snug">
                        {item.tagline}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {character && tab === 'explain' && knowledge && !atEnd && (
            <div className="space-y-4">
              {step === 0 && (
                <div className="flex gap-3">
                  <CharacterAvatar id={character.id} size={40} talking />

                  <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 flex-1">
                    <HeroSpeech key={`intro-${character.id}`} text={character.greeting} voice={character.id} />
                  </div>
                </div>
              )}

              {step === 0 && (
                <div className="flex gap-3">
                  <CharacterAvatar id={character.id} size={40} talking />

                  <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 flex-1">
                    <HeroSpeech key={`kintro-${character.id}`} text={knowledge.intro} voice={character.id} />
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border bg-background px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <HeroIcon className="h-4 w-4 text-primary shrink-0" />

                  <span className="text-sm font-bold text-foreground">{knowledge.steps[step].title}</span>
                </div>

                <HeroSpeech
                  key={`step-${character.id}-${step}`}
                  text={knowledge.steps[step].text}
                  voice={character.id}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={step === 0}
                  onClick={() => {
                    playSfx('click');
                    setStep((value) => Math.max(0, value - 1));
                  }}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Назад
                </Button>

                <div className="flex gap-1.5" aria-hidden="true">
                  {knowledge.steps.map((_, index) => (
                    <span
                      key={index}
                      className={`h-2 w-2 rounded-full transition-colors duration-300 ${index === step ? 'bg-primary' : index < step ? 'bg-primary/40' : 'bg-border'}`}
                    />
                  ))}
                </div>

                {step < knowledge.steps.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      playSfx('click');
                      setStep((value) => value + 1);
                    }}
                  >
                    Дальше <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      playSfx('finish');
                      setStep(knowledge.steps.length);
                    }}
                  >
                    Итог <Sparkles className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          )}
          {character && tab === 'explain' && knowledge && atEnd && (
            <div className="space-y-3 animate-adam-enter">
              <div className="flex gap-3">
                <CharacterAvatar id={character.id} size={32} talking />

                <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 flex-1">
                  <HeroSpeech key={`outro-${character.id}`} text={knowledge.outro} voice={character.id} />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Совет от {character.name}
                </p>

                <p className="text-sm text-foreground leading-relaxed">{knowledge.bookTip}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Книги раздела</p>

                <div className="space-y-2">
                  {heroSources.length === 0 ? (
                    <p className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                      Спроси героя во вкладке «Спросить» — он найдёт книги по этой теме
                      в фонде ЭБС и покажет библиографию по ГОСТ Р.
                    </p>
                  ) : (
                    heroSources.map((item, index) => (
                      <div
                        key={`${item.title}-${index}`}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                      >
                        <div className="flex items-start gap-2">
                          <BookOpen className="mt-0.5 h-4 w-4 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2">{item.title}</span>
                            {item.gost && (
                              <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                                {item.gost}
                              </span>
                            )}
                            {item.url && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="mt-1 inline-block text-[11px] text-primary hover:underline"
                              >
                                Открыть в ЭБС
                              </a>
                            )}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveId(null);
                      setStep(0);
                    }}
                  >
                    Другой герой
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => {
                      playSfx('open');
                      setTab('quiz');
                    }}
                  >
                    <ListChecks className="h-4 w-4 mr-1" /> Пройти тест
                  </Button>
                </div>
              </div>
            </div>
          )}

          {character && tab === 'ask' && (
            <div className="space-y-3 animate-adam-enter">
              <div className="flex gap-3">
                <CharacterAvatar id={character.id} size={40} talking={heroThinking} />

                <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 flex-1">
                  {heroAnswer === null && !heroFailed ? (
                    <HeroSpeech
                      text={`Спрашивай! Я найду книги по твоей теме в фонде ЭБС и отвечу по ним — со ссылками и по ГОСТ Р.`}
                      voice={character.id}
                    />
                  ) : heroFailed ? (
                    <p className="text-sm text-foreground">
                      Не получилось связаться с библиотекой. Проверь, что сервер доступен, и
                      попробуй ещё раз.
                    </p>
                  ) : (
                    <HeroSpeech
                      key={`ask-${character.id}-${heroAnswer?.length ?? 0}`}
                      text={heroAnswer ?? ''}
                      voice={character.id}
                    />
                  )}
                </div>
              </div>

              {heroThinking && (
                <p className="text-xs text-muted-foreground" role="status">
                  {character.name} думает, ответ будет через минуту…
                </p>
              )}

              {heroSources.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    Источники по теме ({heroSources.length})
                  </p>

                  <div className="space-y-2">
                    {heroSources.map((item, index) => (
                      <div
                        key={`src-${item.title}-${index}`}
                        className="rounded-xl border border-border bg-background px-3 py-2"
                      >
                        <p className="text-sm text-foreground leading-snug">{item.title}</p>
                        {item.authors && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.authors}</p>
                        )}
                        {item.gost && (
                          <p className="mt-1 rounded bg-muted/60 p-1.5 text-[11px] leading-relaxed text-muted-foreground">
                            {item.gost}
                          </p>
                        )}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="mt-1 inline-block text-[11px] text-primary hover:underline"
                          >
                            Открыть в ЭБС
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {heroAnswer !== null && heroSources.length === 0 && !heroFailed && (
                <p className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  В фонде ЭБС по этой теме подходящих изданий нет — герой ответил честно,
                  ничего не выдумывая. Попробуй другую формулировку.
                </p>
              )}

              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="sr-only">Вопрос герою</span>
                  <input
                    type="text"
                    value={heroQuestion}
                    onChange={(event) => setHeroQuestion(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void askTheHero();
                      }
                    }}
                    placeholder="Например: что почитать по конституционному праву?"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70"
                  />
                </label>

                <Button size="sm" onClick={() => void askTheHero()} disabled={heroThinking || !heroQuestion.trim()}>
                  {heroThinking ? 'Ждём…' : heroFailed ? (
                    <><RefreshCw className="h-4 w-4 mr-1" /> Повторить</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-1" /> Спросить</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {character && tab === 'quiz' && (
            <div className="space-y-3 animate-adam-enter">
              <div className="flex gap-3">
                <CharacterAvatar id={character.id} size={40} talking />

                <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 flex-1">
                  <HeroSpeech text={quizIntro} voice={character.id} />
                </div>
              </div>

              <CharacterQuiz key={character.id} categoryId={character.categoryId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Плавающая кнопка + панель: ставится один раз в App. */
export function AdamAssistant({ initialCategory }: { initialCategory?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    unlockSpeech();
  }, [open]);

  return open ? (
    <AdamPanel onClose={() => setOpen(false)} initialCategory={initialCategory} />
  ) : (
    <AdamLauncher
      onOpen={() => {
        unlockSpeech();
        playSfx('open');
        setOpen(true);
      }}
    />
  );
}

export default AdamAssistant;
