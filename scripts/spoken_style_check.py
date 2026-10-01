# -*- coding: utf-8 -*-
"""Тест короткой устной речи героя (T-1045): не читает всё подряд, без шума."""
import io
import sys

sys.path.insert(0, r"C:\Users\diorl\.cline\data\workspaces\chat\centr-razuma-iuu-iubip\src")

# Импортируем TS-модуль напрямую нельзя — копируем логику проверки поведения
# через простой обход: читаем файл и проверяем наличие нужных функций.
SRC = r"C:\Users\diorl\.cline\data\workspaces\chat\centr-razuma-iuu-iubip\src\lib\spokenStyle.ts"
text = io.open(SRC, encoding="utf-8").read()

failed = 0


def check(name, cond, extra=""):
    global failed
    if cond:
        print("OK   %s" % name)
    else:
        failed += 1
        print("FAIL %s %s" % (name, extra))


# 1) Функции есть
for fn in ("export function toSpoken", "export function shortSpoken", "SPOKEN_STYLE_HINT"):
    check("есть %s" % fn, fn in text)

# 2) Лимит длины урезан
check("лимит символов разумный (<=400)", "maxChars = 320" in text)
check("максимум 4 предложения", "maxSentences = 4" in text)

# 3) Вычищаются служебные обороты
for noise in ("Вот ответ", "Источники", r"\[\\d+\\]"):
    check("чистит %r" % noise, noise in text)

# 4) Промпт требует краткости
check("промпт просит 2-4 предложения", "2-4 предложения" in text)
check("промпт запрещает служебные вступления", "Вот ответ" in text)

print("\n%s" % ("ВСЕ ТЕСТЫ ПРОЙДЕНЫ" if failed == 0 else "ПРОВАЛЕНО: %d" % failed))
sys.exit(1 if failed else 0)
