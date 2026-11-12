# Publikacja, kontrola i awaria

Krótka instrukcja dla właściciela opublikowanej wersji. Aplikacja to statyczne pliki z `dist/`: bez serwera, bazy, kont i kluczy. Dane odwiedzających zostają w ich przeglądarkach.

- **Hosting:** Vercel, projekt połączony z repozytorium GitHub `myslajek/doroboty-ai`. Ustawienia builda są w `vercel.json` (Vite, `npm ci`, `npm run build`, katalog `dist`), wersja Node w `package.json` (`24.x`).
- **Odbiorcy:** osoby oceniające prototyp DoRoboty.ai.
- **Właściciel:** autor projektu, właściciel repozytorium `myslajek/doroboty-ai`. Ma dostęp do repozytorium i projektu na Vercelu, reaguje na zgłoszenia.
- **Zgłoszenia problemów:** <https://github.com/myslajek/doroboty-ai/issues> (link w stopce, na stronie „Prywatność” i na ekranie awaryjnym). Stan publikacji i poprzednie wersje: panel Vercela.

## Publikacja wersji

1. Na Node 24 uruchom `./scripts/verify`. Publikuj tylko commit, dla którego wszystko przeszło.
2. Wypchnij gałąź i otwórz pull request do `main`. CI (`.github/workflows/ci.yml`) powtarza kontrole, a Vercel buduje podgląd tego commita. Adresy podglądu są domyślnie widoczne tylko po zalogowaniu do Vercela (Deployment Protection), więc nie nadają się dla oceniających.
3. Scal pull request do `main`. Vercel buduje ten commit i podpina go pod adres produkcyjny. Opublikowana wersja to zawsze konkretny commit z `main`; widać go w panelu Vercela przy wdrożeniu.
4. Wykonaj kontrolę po publikacji (niżej). Dopiero potem podaj adres produkcyjny oceniającym.

Pierwsze podłączenie (jednorazowo): w panelu Vercela wybierz **New Project**, wskaż repozytorium `myslajek/doroboty-ai`, zostaw wykryte ustawienia (Framework Preset: Vite) i kliknij **Deploy**. Nie dodawaj zmiennych środowiskowych: aplikacja żadnych nie potrzebuje, a `VITE_ASSISTANT_MODE` ma pozostać nieustawione. Gałęzią produkcyjną jest `main`.

## Kontrola po publikacji

Wykonuje właściciel (albo agent, któremu podasz adres):

```sh
npm run smoke -- https://ADRES-PRODUKCYJNY/
```

Skrypt otwiera stronę w tymczasowej przeglądarce i sprawdza:

- strona odpowiada po HTTPS,
- pracodawca (Karolina) ocenia 20 aplikacji z asystentem: „Asystent ocenił 20 z 20 aplikacji.”,
- widać pasek „Wersja demonstracyjna”, a ocena zostaje po odświeżeniu,
- nie ma żądań poza własny adres ani do `/__assistant/`, odpowiedzi 4xx/5xx ani błędów w konsoli,
- wymuszony błąd testowy pokazuje ekran awaryjny „Coś poszło nie tak”.

**Warunek wycofania:** jeśli którykolwiek punkt nie przechodzi, adres nie trafia do oceniających, a wersję wycofujesz (niżej).

## Wycofanie wersji

Cofnięcie nie dotyka żadnych danych: aplikacja nie ma danych po stronie serwera, a format zapisu w przeglądarce (`doroboty.prototype.v1`) się nie zmienia.

- **Jest poprzednia działająca wersja:** w panelu Vercela otwórz projekt i na kafelku wdrożenia produkcyjnego kliknij **Instant Rollback**, wybierz poprzednie wdrożenie, **Continue**, potem **Confirm Rollback**. Na planie Hobby można wrócić tylko do bezpośrednio poprzedniego wdrożenia. Po cofnięciu Vercel przestaje automatycznie podpinać nowe wdrożenia pod adres produkcyjny; gdy poprawka będzie gotowa, kliknij **Manage** na kafelku produkcyjnym i wypromuj właściwe wdrożenie.
- **Nie ma poprzedniej wersji (pierwsza publikacja):** wycofaj wdrożenie, czyli usuń je w zakładce **Deployments** (menu ⋮ przy wdrożeniu), i nie podawaj adresu dalej, dopóki poprawiona wersja nie przejdzie kontroli.
- Poprawkę przygotuj zwykłą drogą: commit, `./scripts/verify`, pull request, scalenie.

## Gdy strona nie działa

1. Otwórz adres produkcyjny i uruchom `npm run smoke -- ADRES`, żeby zobaczyć, który punkt pada.
2. W panelu Vercela sprawdź ostatnie wdrożenie: czy build się udał i który commit jest na produkcji.
3. Jeśli zawiniła ostatnia zmiana, wycofaj wersję (wyżej). Jeśli strona jest wstrzymana przez Vercela (limity planu), sprawdź zakładkę **Usage**.
4. Daj znać oceniającym tam, gdzie dostali link, że strona jest chwilowo niedostępna, i odpowiedz na otwarte zgłoszenie na GitHubie.
5. Po naprawie powtórz kontrolę po publikacji.

Błąd u pojedynczej osoby: ekran „Coś poszło nie tak” prosi o odświeżenie i zgłoszenie na GitHubie. Aplikacja niczego nie wysyła, więc o takim błędzie dowiesz się tylko ze zgłoszenia.
