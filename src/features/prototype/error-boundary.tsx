import { buttonVariants } from "@/components/ui/button";
import { SUPPORT_URL } from "@/lib/support";

export function ErrorFallback() {
  return (
    <main className="mx-auto max-w-[1360px] px-5 lg:px-8">
      <section className="prototype-section" role="alert">
        <h1>Coś poszło nie tak</h1>
        <p className="my-5 max-w-2xl">
          Strona napotkała nieprzewidziany błąd. Zmiany zapisane w tej przeglądarce nie zostały
          usunięte. Odśwież stronę; jeśli błąd wraca, zgłoś go i opisz, co było na ekranie i co
          zostało kliknięte. Nie wklejaj prawdziwych danych osobowych.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={buttonVariants()}
            onClick={() => window.location.reload()}
          >
            Odśwież stronę
          </button>
          <a
            className={buttonVariants({ variant: "outline" })}
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Zgłoś problem<span className="sr-only"> na GitHubie, w nowej karcie</span>
          </a>
        </div>
      </section>
    </main>
  );
}
