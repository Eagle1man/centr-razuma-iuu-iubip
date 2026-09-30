# -*- coding: utf-8 -*-
"""DoD-проверка T-1039/T-1035: демо-книги не попали в бандл, новые фичи есть.

Запуск (из корня репозитория, после npm run build):
    python scripts/bundle_check.py
"""
import glob
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

BUNDLES = sorted(glob.glob("dist/assets/*.js"))
if not BUNDLES:
    print("FAIL нет dist/assets/*.js — сначала npm run build")
    sys.exit(1)
BUNDLE = BUNDLES[0]
text = io.open(BUNDLE, encoding="utf-8", errors="ignore").read()

failed = 0


def check(name, cond, extra=""):
    global failed
    if cond:
        print("OK   %s" % name)
    else:
        failed += 1
        print("FAIL %s %s" % (name, extra))


# Выдуманные КНИГИ не должны попасть в бандл (T-1035: герои не имеют права
# называть издания, которых может не быть в фонде ЭБС).
FAKE_BOOKS = [
    "Индустрия гостеприимства: структура и экономика",
    "Теория государства и права: базовый курс",
    "Экономика и управление организацией",
    "Фармация и сестринское дело: основы",
    "Маркетинг: практический курс",
    "Кабушкин",
    "Ильина",
]
for _name in FAKE_BOOKS:
    check("нет выдуманной книги: %s" % _name, _name not in text)

# Мёртвый демо-каталог удалён целиком
check("нет демо-каталога (libraryData)", "CATALOG_DRAFT" not in text)
low = text.lower()
check("нет регистрации / входа", "signup" not in low and "/login" not in low)
check("нет клиента Supabase", "signInAnonymously" not in text)

# Новые возможности на месте
check("есть /ask-books (говорящие аватары)", "ask-books" in text)
check("есть блок уточнения запроса", "уточните запрос" in low)
check("есть вкладка 'Спросить'", "Спросить" in text)
check("есть карточки направлений (it-web)", "it-web" in text)
check("есть озвучка ответов (speechSynthesis)", "speechSynthesis" in text)
check("нет врущей заглушки деплоя", "станет доступен после деплоя" not in text)

print("\nБандл: %s (%.0f КБ)" % (BUNDLE, len(text) / 1024))
print("ИТОГ: %s" % ("ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ" if failed == 0 else "ПРОВАЛЕНО: %d" % failed))
sys.exit(1 if failed else 0)
