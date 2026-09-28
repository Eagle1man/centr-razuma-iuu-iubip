@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Голоса героев — установка RHVoice (SAPI5)

rem install-voices.bat — ставит русские голоса RHVoice как системные (SAPI5),
rem чтобы Яндекс Браузер (и Chrome) увидели их в списке "Голос героев".
rem
rem Почему GitHub: rhvoice.su и зеркало Linode у части провайдеров не открываются,
rem а в релизах репозиториев RHVoice лежат те же официальные установщики:
rem   RHVoice/aleksandr-rus (мужской), RHVoice/elena-rus, RHVoice/irina-rus.
rem
rem Запуск: обычный двойной клик - скрипт сам попросит подтверждение UAC
rem (можно и правый клик -> "Запуск от имени администратора").
rem Тихий режим установки задаётся переменной SILENT ниже (/S = тихо,
rem пусто = обычный мастер установки, если хочется видеть окна).

rem --- рабочая папка: C:\Users\Public\RHVoice ------------------------------
rem ВАЖНО: раньше качали в %TEMP% - при повышении прав Windows может
rem подставить ЧУЖОЙ временный каталог, и файлы оказываются не там,
rem где вы их ищете. Public-папка общая для всех запусков.
set "WORK=%PUBLIC%\RHVoice"
if not exist "%WORK%" mkdir "%WORK%" >nul 2>&1
if not exist "%WORK%" set "WORK=%TEMP%\rhvoice-voices"
if not exist "%WORK%" mkdir "%WORK%" >nul 2>&1
set "LOG=%WORK%\install.log"
set "SILENT=/S"

>>"%LOG%" echo.
>>"%LOG%" echo ==== запуск %date% %time% ====
>>"%LOG%" echo WORK=%WORK%

rem --- права администратора: при обычном запуске сам прошу UAC -------------
rem (двойного клика достаточно: откроется второе окно уже с правами админа)
net session >nul 2>&1
if not errorlevel 1 goto :admin_ok

echo.
echo   Запрашиваю права администратора - в окне UAC нажмите "Да".
echo   Установка пойдёт в НОВОМ окне. Это окно можно закрыть.
>>"%LOG%" echo UAC: запрошены права администратора
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
echo.
echo   Если новое окно не открылось - правый клик по install-voices.bat
echo   и "Запуск от имени администратора".
echo   Не понимаете, где скрипт остановился? Журнал: %LOG%
echo.
pause
exit /b 0

:admin_ok

if not exist "%WORK%" mkdir "%WORK%" >nul 2>&1

rem --- curl есть в Windows 10/11 из коробки -------------------------------
set "CURL=%SystemRoot%\System32\curl.exe"
if not exist "%CURL%" set "CURL=curl.exe"

echo.
echo   Папка загрузки: %WORK%
echo   Журнал: %LOG%
echo   Каждый файл сверяется по размеру и SHA-256 перед запуском.
>>"%LOG%" echo Права администратора: есть. Начинаю установку.
echo.

call :voice "RHVoice-voice-Russian-Aleksandr-v4.2.2017.22-setup.exe" "https://github.com/RHVoice/aleksandr-rus/releases/download/4.2/RHVoice-voice-Russian-Aleksandr-v4.2.2017.22-setup.exe" 10502655 6f89681eef32d9d0f05f05592953904a7af938ab2c7926827ae4f7a8d806f593
call :voice "RHVoice-voice-Russian-Elena-v4.3.2017.22-setup.exe" "https://github.com/RHVoice/elena-rus/releases/download/v4.3/RHVoice-voice-Russian-Elena-v4.3.2017.22-setup.exe" 8228573 23e1301869e842f8f91fe64cc34533f9996724ec609962a24e6d5dee7828b643
call :voice "RHVoice-voice-Russian-Irina-v4.1.2017.22-setup.exe" "https://github.com/RHVoice/irina-rus/releases/download/4.1/RHVoice-voice-Russian-Irina-v4.1.2017.22-setup.exe" 15693258 e22888281da06ce194e69fcb5119e4b29d985728c75b6499e9f570ef227a1ff1

echo.
echo   Голоса, которые сейчас видит Windows:
>>"%LOG%" echo Голоса, которые видит Windows:
powershell -NoProfile -Command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; foreach ($v in $s.GetInstalledVoices()) { '{0} [{1}]' -f $v.VoiceInfo.Name, $v.VoiceInfo.Culture.Name }"
powershell -NoProfile -Command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; foreach ($v in $s.GetInstalledVoices()) { '{0} [{1}]' -f $v.VoiceInfo.Name, $v.VoiceInfo.Culture.Name }" >>"%LOG%" 2>&1

echo.
echo   Папка с установщиками (откроется сама): C:\Users\Public\RHVoice
start "" explorer.exe "%WORK%"

echo.
echo   Дальше:
echo     1. Полностью закройте Яндекс Браузер (все окна) и откройте заново.
echo     2. Откройте сайт и нажмите на любого героя.
echo     3. В строке "Голос героев" выберите голос RHVoice (имя — как в списке выше).
echo.
echo   Если RHVoice в списке не появился, добавьте системные голоса Microsoft:
echo     Параметры - Время и язык - Речь - Управление голосами - Добавить голоса - Русский.
echo     Появятся "Microsoft Pavel" (мужской) и "Microsoft Irina" (женский).
echo.
echo   Если тихий режим (/S) не сработал — откройте этот файл в блокноте,
echo   замените  set "SILENT=/S"  на  set "SILENT="  и запустите снова:
echo   установщик откроется с обычным мастером "Далее - Далее".
echo.
pause
exit /b 0

rem ====================================================================
rem  :voice <имя файла> <url> <ожидаемый размер> <sha256>
rem  Скачивает, проверяет и запускает один установщик голоса.
rem ====================================================================
:voice
set "FILE=%~1"
set "URL=%~2"
set "WANT_SIZE=%~3"
set "WANT_HASH=%~4"
set "EXE=%WORK%\%FILE%"

echo   --- %FILE%
>>"%LOG%" echo --- %FILE%

if exist "%EXE%" (
  for %%S in ("%EXE%") do set "SIZE=%%~zS"
  if "!SIZE!"=="%WANT_SIZE%" (
    echo       файл уже скачан, проверяю SHA-256
    goto :voice_check
  )
  echo       прошлая загрузка неполная — качаю заново
  del /f /q "%EXE%" >nul 2>&1
)

echo       скачивание с GitHub...
"%CURL%" -L --fail --retry 3 --retry-delay 2 --connect-timeout 20 -o "%EXE%" "%URL%"
if errorlevel 1 (
  echo       [ОШИБКА] скачать не удалось.
  echo       Скачайте файл вручную в браузере: %URL%
  echo       и положите его в папку %WORK%
  >>"%LOG%" echo     [ОШИБКА] скачать не удалось: %URL%
  exit /b 1
)

:voice_check
for %%S in ("%EXE%") do set "SIZE=%%~zS"
if not "!SIZE!"=="%WANT_SIZE%" (
  echo       [ОШИБКА] размер !SIZE! вместо %WANT_SIZE% — файл битый, удаляю.
  del /f /q "%EXE%" >nul 2>&1
  exit /b 1
)

set "HASH="
for /f "skip=1 delims=" %%H in ('certutil -hashfile "%EXE%" SHA256 2^>nul') do (
  if not defined HASH set "HASH=%%H"
)
set "HASH=!HASH: =!"
if /i not "!HASH!"=="%WANT_HASH%" (
  echo       [ОШИБКА] SHA-256 не совпала: !HASH!
  echo       Файл удалён, повторите запуск скрипта.
  del /f /q "%EXE%" >nul 2>&1
  exit /b 1
)

echo       SHA-256 совпала, ставлю голос...
start /wait "" "%EXE%" %SILENT%
echo       готово.
>>"%LOG%" echo     готово
exit /b 0