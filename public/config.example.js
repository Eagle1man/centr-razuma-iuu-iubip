// Шаблон конфигурации рантайма.
//
// На боевом сайте объект window.__APP_CONFIG__ инжектит билдер Wuna — в
// собранном index.html его видно целиком (apiUrl, projectId, apiToken,
// supabase.url / publishableKey / schema).
//
// Для локального запуска:
//   1. скопируйте этот файл в public/config.js;
//   2. впишите реальные значения (apiToken — в кабинете Wuna, Supabase-поля —
//      из собранного index.html);
//   3. добавьте в index.html перед </body> строку:
//        <script src="/config.js"></script>
//   4. public/config.js уже указан в .gitignore — секреты в репозиторий не попадут.
//
// Без заполненного конфига сайт работает как каталог: авторизация и хранилище
// просто отключаются (useAuth вернёт понятное сообщение об ошибке).

window.__APP_CONFIG__ = {
  apiUrl: "https://app.wuna.ai",
  projectId: "01a07324-daa8-7134-ad90-a54915f6d275",
  apiToken: "",
  siteName: "Центр разума ЮУ ИУБиП",
  // Base URL библиотечного бэкенда (новый роутер /api; плоские пути FastAPI не трогать).
  libraryApi: "/api",
  supabase: {
    url: "",
    publishableKey: "",
    schema: ""
  }
};
