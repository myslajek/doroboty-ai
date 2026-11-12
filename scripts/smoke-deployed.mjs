// Kontrola po publikacji: przechodzi główną ścieżkę pod podanym adresem i kończy kodem 1, gdy
// coś nie działa. Użycie: npm run smoke -- https://adres-strony/
// Niczego nie zapisuje poza pamięcią własnej, tymczasowej przeglądarki.
import { chromium } from "@playwright/test";

const base = (process.argv[2] ?? "").replace(/\/?$/, "/");
if (!/^https?:\/\//.test(base)) {
  console.error("Podaj adres strony, np. npm run smoke -- https://example.vercel.app/");
  process.exit(2);
}
const origin = new URL(base).origin;
const browser = await chromium.launch();
const problems = [];
const check = (ok, label) => {
  console.log(`${ok ? "OK  " : "BŁĄD"} ${label}`);
  if (!ok) problems.push(label);
};
try {
  const page = await browser.newPage();
  const requests = [];
  const failed = [];
  const errors = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  const first = await page.goto(base);
  check(first?.ok() === true, `strona odpowiada pod ${base} (status ${first?.status()})`);
  check(
    base.startsWith("https://") || /^http:\/\/(127\.0\.0\.1|localhost)/.test(base),
    "połączenie szyfrowane (HTTPS)",
  );
  await page.goto(`${base}#/auth/sign-in`);
  await page.getByRole("button", { name: "Wejdź jako Karolina Wiśniewska", exact: true }).click();
  await page.goto(`${base}#/app/kandydaci`);
  await page.getByRole("button", { name: /Oceń odpowiedzi z asystentem \(20\)/ }).click();
  const batch = page.getByText(/Asystent ocenił \d+ z \d+ aplikacji\./);
  await batch.waitFor({ timeout: 30_000 });
  check((await batch.textContent()) === "Asystent ocenił 20 z 20 aplikacji.", "ocena 20 z 20");
  await page.locator("article.prototype-panel a").first().click();
  await page.getByRole("heading", { name: "Odpowiedzi na pytania pracodawcy" }).waitFor();
  check(
    (await page.locator('[data-assistant="simulated"]').count()) > 0,
    "pasek „Wersja demonstracyjna” jest widoczny",
  );
  await page.reload();
  check(
    (await page.getByText(/Asystent: \d+%/).count()) > 0,
    "ocena zostaje po odświeżeniu strony",
  );
  const external = [
    ...new Set(requests.filter((u) => /^https?:/.test(u) && !u.startsWith(origin))),
  ];
  check(external.length === 0, `brak żądań poza własny adres (${external.length})`);
  check(!requests.some((u) => u.includes("/__assistant/")), "brak żądań do mostu asystenta");
  check(failed.length === 0, `brak odpowiedzi 4xx/5xx (${failed.join(", ") || "0"})`);
  check(errors.length === 0, `brak błędów w konsoli (${errors.length})`);

  // Bezpieczny błąd testowy: wymuszony tylko w tej przeglądarce, żeby zobaczyć ekran awaryjny.
  const crash = await browser.newPage();
  await crash.addInitScript(() => {
    Date.prototype.getFullYear = () => {
      throw new Error("Błąd testowy ekranu awaryjnego");
    };
  });
  await crash.goto(base);
  check(
    await crash
      .getByRole("heading", { name: "Coś poszło nie tak", exact: true })
      .isVisible({ timeout: 10_000 })
      .catch(() => false),
    "ekran awaryjny pojawia się przy nieprzewidzianym błędzie",
  );
} catch (error) {
  check(false, `przejście przerwane: ${error.message.split("\n")[0]}`);
} finally {
  await browser.close();
}
console.log(problems.length ? `\nNIE PRZESZŁO: ${problems.length}` : "\nPrzeszło.");
process.exit(problems.length ? 1 : 0);
