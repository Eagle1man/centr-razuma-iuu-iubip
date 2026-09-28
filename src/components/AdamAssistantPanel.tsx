import { useEffect, useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import {
  AudioLines,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Coins,
  Compass,
  FlaskConical,
  ListChecks,
  Sparkles,
  Swords,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Button } from './ui/button';
import {
  describeVoice,
  getVoicePref,
  getVoiceQuality,
  getVoiceRate,
  isSoundEnabled,
  isVoiceEnabled,
  listRuVoices,
  onSoundSettingsChange,
  playSfx,
  playVoice,
  prepareSpeechText,
  setVoicePref,
  setVoiceRate,
  speakHero,
  speakText,
  stopSpeaking,
  toggleSound,
  toggleVoice,
  unlockSpeech,
  voiceTwin,
  type VoiceReport,
} from '../lib/heroSounds';
import { ADAM_GREETING, getAdamKnowledge } from '../lib/adamKnowledge';
import { getBooksByCategory } from '../lib/libraryData';
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
  { id: 'quiz' as const, label: 'Тест', icon: ListChecks },
];

/* Фраза-ловушка для проверки произношения: путь, ссылка, единица измерения,
   сокращение и латиница. Ровно то, что раньше читалось вслух как «бэк слэш
   стретч» и «эн пи эм». */
const PRONOUNCE_TEST =
  'Открой файл C:\\Users\\user\\docs\\readme.md, затем перейди на https://example.com/guide, купи 20 см. ткани, т. д., и выполни npm install.';

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
  const [tab, setTab] = useState<'explain' | 'quiz'>('explain');
  const [step, setStep] = useState(0);
  const [sound, setSound] = useState(isSoundEnabled());
  const [voice, setVoice] = useState(isVoiceEnabled());
  const [voiceQuality, setVoiceQuality] = useState<'natural' | 'standard' | 'none'>('natural');
  const [voicesList, setVoicesList] = useState<SpeechSynthesisVoice[]>([]);
  const [voicePref, setVoicePrefState] = useState(getVoicePref('all'));
  const [voiceRate, setVoiceRateState] = useState(getVoiceRate());

  /* Качество голосов зависит от браузера и системы, а список голосов Chrome
     отдаёт асинхронно — проверяем дважды и по событию voiceschanged. */
  useEffect(() => {
    const check = () => {
      setVoiceQuality(getVoiceQuality());
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
  const books = character ? getBooksByCategory(character.categoryId).slice(0, 4) : [];
  const atEnd = knowledge ? step >= knowledge.steps.length : false;
  const HeroIcon = character ? HERO_ICONS[character.id] : HERO_ICONS.adam;
  const quizIntro = character ? QUIZ_BANKS[character.categoryId]?.intro ?? '' : '';

  const selectCharacter = (id: CharacterId) => {
    playSfx('click');
    playVoice(id);
    setActiveId(id);
    setTab('explain');
    setStep(0);
  };

  /* Что система произнесёт на самом деле: имя голоса, темп и чей это голос.
     Пересчитываем при смене героя, голоса, темпа и списка системных голосов. */
  const [report, setReport] = useState<VoiceReport | null>(null);
  useEffect(() => {
    if (!voice || !character) {
      setReport(null);
      return;
    }
    setReport(describeVoice(character.id));
  }, [voice, character, voicesList, voicePref, voiceRate]);

  const twinId = character ? voiceTwin(character.id) : undefined;
  const twin = character && twinId && twinId !== character.id ? twinId : null;
  const twinName = twin ? CHARACTERS.find((item) => item.id === twin)?.name ?? null : null;

  /* Одно и то же предложение дважды подряд: сначала героем, затем его
     близнецом. Равенство голосов слышно сразу, а не по памяти. */
  const compareWithTwin = () => {
    if (!character) return;
    const phrase = 'Слушайте, как я читаю одно и то же предложение.';
    stopSpeaking();
    window.setTimeout(() => {
      speakText(phrase, {
        character: character.id,
        onEnd: twin ? () => window.setTimeout(() => speakHero(phrase, twin), 700) : undefined,
      });
    }, 100);
  };

  const testPronunciation = () => {
    if (!character) return;
    stopSpeaking();
    window.setTimeout(() => speakHero(PRONOUNCE_TEST, character.id), 100);
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
                    // Короткая проба новым голосом, чтобы услышать выбор сразу.
                    if (next) {
                      stopSpeaking();
                      window.setTimeout(() => speakHero('Привет! Так звучит новый голос.', undefined), 80);
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
                  В системе всего один русский голос — {voicesList[0].name}. Чтобы было из чего
                  выбирать, добавьте ещё: «Параметры → Время и язык → Речь → Управление голосами».
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
                onPointerUp={() => {
                  // Проба темпа голосом открытого героя — слышно сразу.
                  stopSpeaking();
                  window.setTimeout(
                    () => speakHero('Так теперь звучат герои: спокойно и размеренно.', character?.id),
                    80,
                  );
                }}
                aria-label="Скорость речи героев"
                className="min-w-0 flex-1 accent-primary"
              />

              <span className="w-9 shrink-0 text-right tabular-nums text-foreground">
                {voiceRate.toFixed(2).replace('.', ',')}×
              </span>
            </label>

            <p className="text-[10px] leading-snug text-muted-foreground">
              Кейн звучит ровно так же, как Адам, а Бани — как Николь: тот же голос и та же
              интонация. Ползунок слева — медленнее и вдумчивее, справа — быстрее.
            </p>

            {character && report && (
              <div className="space-y-2 rounded-md border border-border bg-background/60 px-2.5 py-2">
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Сейчас говорит голосом{' '}
                  <span className="font-medium text-foreground">{report.voiceName}</span>
                  {' · темп '}
                  {report.rate.toFixed(2).replace('.', ',')}
                  {twinName && (
                    <>
                      {' · это голос '}
                      <span className="font-medium text-foreground">{twinName}</span>
                    </>
                  )}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {twinName && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={compareWithTwin}
                    >
                      <AudioLines className="h-3 w-3 mr-1" /> Сравнить с {twinName}
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={testPronunciation}
                  >
                    <BookOpen className="h-3 w-3 mr-1" /> Проверить произношение
                  </Button>
                </div>

                <p className="text-[10px] leading-snug text-muted-foreground">
                  Будет произнесено: «{prepareSpeechText(PRONOUNCE_TEST)}»
                </p>
              </div>
            )}
          </div>
        )}

        {voice && voiceQuality === 'standard' && !voicePref && voicesList.length !== 1 && (
          <p className="mx-4 mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
            Голоса звучат машинно: в этом браузере нет нейронных голосов. Откройте сайт в{' '}
            <span className="font-medium text-foreground">Microsoft Edge</span> — там русские голоса
            «Online Natural» (Dmitry и Svetlana) звучат по-человечески, как дикторские. Либо добавьте
            голоса в Windows: «Параметры → Время и язык → Речь → Управление голосами → Добавить
            голоса», полностью закройте и откройте браузер, а затем выберите голос в селекторе выше.
            Голоса RHVoice ставит{' '}
            <span className="font-medium text-foreground">install-voices.bat</span>.
          </p>
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
                  {books.map((item) => (
                    <Link
                      key={item.id}
                      to={`/book/${item.id}`}
                      onClick={onClose}
                      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      <BookOpen className="h-4 w-4 shrink-0" />

                      <span className="line-clamp-1">{item.title}</span>
                    </Link>
                  ))}
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
