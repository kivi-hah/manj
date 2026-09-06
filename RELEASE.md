# Релизы: exe и публикация на GitHub

## Сборка exe

```bash
npm run tauri:build
```

Результат в `src-tauri/target/release/`:
- `Manj.exe` — портабельная версия (один файл, можно раскидывать);
- `bundle/nsis/Manj_0.1.0_x64-setup.exe` — установщик (ярлык, деинсталлятор);
- `bundle/msi/…` — MSI-пакет (альтернатива).

Требования на машине сборки: Node.js, Rust, MSVC Build Tools (уже есть).
Пользователю для запуска ничего ставить не нужно — WebView2 уже в Windows 10/11.

## Публикация на GitHub — план

1. **Репозиторий**: создать приватный/публичный репо, залить код
   (`.gitignore` уже исключает `node_modules`, `dist`, `target`).
2. **Сборка локально** → приложить `Manj_x.y.z_x64-setup.exe` к GitHub Release
   (Releases → Draft new release → тег `v0.1.0` → attach файлы + CHANGELOG
   из `src/components/UpdatesOverlay.tsx`).
3. **Автосборка (когда понадобится)**: GitHub Actions workflow
   `.github/workflows/release.yml` — на тег `v*` поднимает windows-latest,
   ставит Node + Rust + tauri-action, собирает и публикует Release.
   Достаточно официального action: `tauri-apps/tauri-action@v0` (секрет
   GITHUB_TOKEN выдаётся автоматически).
4. **Обновления в приложении**: кнопка «Обновления» уже показывает
   CHANGELOG (константа в `UpdatesOverlay.tsx`). Следующий шаг — проверять
   `https://api.github.com/repos/<user>/<repo>/releases/latest` и предлагать
   скачать установщик (Rust: tauri-plugin-updater, но для него нужна
   подпись обновлений — на этапе беты достаточно ручной кнопки).
5. **Версия**: менять в трёх местах — `package.json`, `src-tauri/tauri.conf.json`,
   запись в CHANGELOG (`UpdatesOverlay.tsx`).

## Чеклист перед публичным релизом
- [ ] Убрать личные client_id/секреты из кода (их нет — VK/Yandex id публичные).
- [ ] README: скриншоты, инструкция по входу.
- [ ] Тег `v0.1.0` + Release notes = содержимое CHANGELOG.
- [ ] Дисклеймер в README: приложение неофициальное, не связано с Яндекс/VK.
