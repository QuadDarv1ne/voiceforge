#!/usr/bin/env python3
"""
freetts_scraper.py — обходит WAF freetts.ru с помощью Playwright (real browser).

Использование:
    python3 freetts_scraper.py <voice_code> <text> <output_path>

Алгоритм:
    1. Запускает headed/headless Chromium с реальным TLS-fingerprint
    2. Открывает https://freetts.ru/
    3. Через page.evaluate() делает POST на /api/v2/s с теми же cookies/headers
    4. Получает base64-аудио, декодирует и сохраняет в output_path
"""

import asyncio
import json
import os
import sys
from pathlib import Path


async def synthesize(voice_code: str, text: str, output_path: str) -> int:
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        # Запускаем Chromium — headless=False через Xvfb лучше обходит WAF,
        # т.к. многие WAF (включая Cloudflare) детектят headless-режим.
        # Если Xvfb не запущен, можно использовать channel="chrome".
        use_headless = os.environ.get("FREETTS_HEADLESS", "0") == "1"

        launch_kwargs = {
            "headless": use_headless,
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-infobars",
                "--window-position=0,0",
                "--window-size=1920,1080",
            ],
        }

        # Если есть системный Chrome — используем его (best TLS fingerprint)
        chrome_path = os.environ.get("CHROME_PATH")
        if chrome_path and Path(chrome_path).exists():
            launch_kwargs["executable_path"] = chrome_path

        try:
            browser = await p.chromium.launch(**launch_kwargs)
        except Exception as e:
            print(f"ERROR: Failed to launch browser: {e}", file=sys.stderr)
            return 1

        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1920, "height": 1080},
            locale="ru-RU",
            timezone_id="Europe/Moscow",
            extra_http_headers={
                "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
            },
        )

        # Скрываем navigator.webdriver и эмулируем реальный браузер
        await context.add_init_script(
            """
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    {name: 'Chrome PDF Plugin'},
                    {name: 'Chrome PDF Viewer'},
                    {name: 'Native Client'}
                ]
            });
            Object.defineProperty(navigator, 'languages', {get: () => ['ru-RU', 'ru', 'en']});
            Object.defineProperty(navigator, 'platform', {get: () => 'Linux x86_64'});
            window.chrome = {runtime: {}, loadTimes: () => {}, csi: () => {}};
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) =>
                parameters.name === 'notifications'
                    ? Promise.resolve({state: Notification.permission})
                    : originalQuery(parameters);
            """
        )

        page = await context.new_page()

        try:
            # Открываем страницу freetts.ru
            response = await page.goto(
                "https://freetts.ru/",
                wait_until="domcontentloaded",
                timeout=45000,
            )
            if response is None or response.status != 200:
                print(
                    f"ERROR: Failed to load freetts.ru (status="
                    f"{response.status if response else 'no response'})",
                    file=sys.stderr,
                )
                # Сохраняем скриншот для дебага
                try:
                    await page.screenshot(path="/tmp/freetts-debug.png")
                    print("Debug screenshot saved to /tmp/freetts-debug.png", file=sys.stderr)
                except:
                    pass
                return 1

            # Ждём полной инициализации
            await page.wait_for_timeout(3000)

            # Делаем POST-запрос через fetch из контекста браузера
            result = await page.evaluate(
                """
                async ({voice, text}) => {
                    try {
                        const res = await fetch('https://freetts.ru/api/v2/s', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json, text/plain, */*',
                            },
                            body: JSON.stringify({voice, text}),
                            credentials: 'include',
                        });
                        const json = await res.json();
                        return {ok: res.ok, status: res.status, json};
                    } catch (e) {
                        return {ok: false, status: 0, error: e.message};
                    }
                }
                """,
                {"voice": voice_code, "text": text},
            )

            if not result.get("ok"):
                print(
                    f"ERROR: API returned status={result.get('status')}, "
                    f"body={json.dumps(result.get('json', result.get('error')))}",
                    file=sys.stderr,
                )
                return 1

            audio_b64 = (
                result.get("json", {}).get("data", {}).get("audioBase64")
            )
            if not audio_b64:
                print(
                    f"ERROR: No audioBase64 in response: "
                    f"{json.dumps(result.get('json'))}",
                    file=sys.stderr,
                )
                return 1

            # Декодируем и сохраняем
            import base64

            audio_bytes = base64.b64decode(audio_b64)
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(audio_bytes)

            print(f"OK: saved {len(audio_bytes)} bytes to {output_path}")
            return 0

        except Exception as e:
            print(f"ERROR: {e}", file=sys.stderr)
            try:
                await page.screenshot(path="/tmp/freetts-error.png")
                print("Error screenshot saved to /tmp/freetts-error.png", file=sys.stderr)
            except:
                pass
            return 1
        finally:
            await browser.close()


def main() -> int:
    if len(sys.argv) != 4:
        print(
            "Usage: freetts_scraper.py <voice_code> <text> <output_path>",
            file=sys.stderr,
        )
        return 2

    voice_code = sys.argv[1]
    text = sys.argv[2]
    output_path = sys.argv[3]

    # Проверка длины текста (лимит freetts — 1024 символа)
    if len(text) > 1024:
        print(
            f"ERROR: Text too long ({len(text)} > 1024 chars)",
            file=sys.stderr,
        )
        return 2

    return asyncio.run(synthesize(voice_code, text, output_path))


if __name__ == "__main__":
    sys.exit(main())
