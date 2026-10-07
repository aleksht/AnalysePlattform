# Aksjeinnsikt

Webapp for aksjeresearch: hva kunder, ansatte og markedet faktisk mener om selskapene du vurderer.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres, Auth, RLS) · Anthropic API · Vercel

## Status

| Fase | Innhold | Status |
|---|---|---|
| 1 | Innlogging, mapper, aksjer, aksjeside med tomme faner | ✅ |
| 2 | Researchagent, lagring og visning av funn med kilder | ✅ |
| 3 | Innsiktsmodus, trend over tid, ukentlig kjøring | ✅ |
| 4 | Finpuss, feilhåndtering, kostnadsoversikt | ✅ |

## Oppsett

### 1. Supabase

1. Lag et prosjekt i regionen **eu-north-1 (Stockholm)**.
2. Kjør migrasjonene i `supabase/migrations/` i rekkefølge (0001–0005). Bruk enten SQL Editor i dashbordet, eller `supabase link` og deretter `supabase db push`.
3. Gå til **Authentication → Sign In / Providers**. Slå av «Allow new users to sign up» og la Email stå på.
4. Gå til **Authentication → Users → Add user → Create new user** og legg inn hver bruker med e-post og passord. Huk av for **Auto Confirm User**. Innlogging skjer med e-post og passord, så det sendes ingen e-post fra Supabase.
5. Hent nøklene under **Project Settings → API Keys**: én publishable-nøkkel og én secret-nøkkel.
6. Legg inn to hemmeligheter i Vault (SQL Editor). pg_cron bruker dem til å vekke arbeideren:

   ```sql
   select vault.create_secret('https://<din-app>.vercel.app', 'app_url');
   select vault.create_secret('<samme verdi som JOB_SECRET>', 'job_secret');
   ```

### 2. Miljøvariabler

Kopier `.env.example` til `.env.local` og fyll ut verdiene. På Vercel legger du de samme variablene inn under **Settings → Environment Variables**.

`ALLOWED_EMAILS` bestemmer hvem som får logge inn. Er den tom, slipper alle inn, så den bør alltid være satt i produksjon.

### 3. Kjør lokalt

```bash
npm install
npm run dev
```

## Slik fungerer researchagenten

En kjøring består av seks researchsteg (oversikt, kunder, ansatte, ledelse, nyheter og konkurrenter) og til slutt et syntesesteg. Hvert researchsteg har to faser:

1. **Research.** Claude (`claude-sonnet-5-5`) søker og leser med web search og web fetch (`web_search_20260318` og `web_fetch_20260318`). Hvert steg har et eget tak på antall søk, og svar som stopper med `pause_turn`, blir videreført.
2. **Uttrekk.** Notatene gjøres om til strengt strukturert JSON med structured outputs. Skjemaet bygges fra zod i `src/lib/research/schema.ts`. Kildene får id-er (S1, S2 …) fra listen over URL-er agenten faktisk så, og modellen kan bare velge blant disse. Hvert funn valideres med zod før det lagres.

**Bakgrunnsjobber:**
- Stegene ligger i tabellen `run_steps`. `/api/jobs/run-step` svarer 202 med en gang og kjører stegene i `after()`, innenfor `maxDuration = 300`.
- Hvis tiden er i ferd med å renne ut, lagres samtalen, og steget fortsetter i neste runde. Feil prøves inntil tre ganger, med økende ventetid.
- pg_cron sjekker hvert minutt om noe venter eller henger.

**Syntese og trend:** Når alle kategoriene er ferdige, kjøres et syntesesteg:
- Stemning beregnes per kategori og tema, vektet etter evidensstyrke.
- Resultatet sammenlignes med forrige kjøring. En endring på minst 0,25 på skalaen fra -1 til 1 regnes som bedre eller verre, og sammenligninger med få funn merkes som usikre.
- Claude skriver hovedkonklusjoner, endringer og punkter å følge med på. Hvert punkt må vise til konkrete funn (F1, F2 …), og punkter uten gyldig funn tas ikke med.

Resultatet vises i rapportvisningen (`/aksjer/[id]/rapport`).

**Ukentlig kjøring:** pg_cron legger aksjer med ukentlig oppdatering i køen hver mandag kl. 04:00 UTC (`enqueue_weekly_runs`). Ukentlig oppdatering slås av og på per aksje under Innstillinger.

**Kostnad og budsjett:**
- Tokenforbruk og antall søk lagres per steg og summeres løpende inn i kjøringen, også for avbrutte kjøringer.
- Kostnaden estimeres ut fra prisene i `src/lib/research/config.ts`.
- Under Innstillinger ser du kostnad per måned, per aksje og per kjøring, og du kan sette et månedsbudsjett (standard 25 USD). Når budsjettet er brukt opp, kan nye kjøringer ikke startes, og ukentlige kjøringer hoppes over.

**Feilhåndtering:**
- Feil fra Anthropic klassifiseres i `src/lib/research/errors.ts`. Ugyldig nøkkel, manglende kreditt og avviste forespørsler feiler med en gang, med en norsk forklaring.
- Overbelastning, grense for antall forespørsler og nettverksfeil prøves på nytt med økende ventetid.
- Feilede steg kan prøves på nytt fra aksjesiden uten å kjøre hele researchen igjen.
- Under Innstillinger viser Systemstatus manglende konfigurasjon og kjøringer som henger.

## Struktur

```
supabase/migrations/   SQL-migrasjoner (tabeller + RLS)
src/proxy.ts           Fornyer sesjonen, sender uinnloggede til /login
src/app/login          Innlogging med e-post og passord
src/app/(app)/         Innloggede sider: oversikt, aksjeside, innstillinger
src/components/        UI-komponenter
src/lib/actions/       Server actions (validert med zod)
src/lib/supabase/      Supabase-klienter
src/lib/research/      Researchagent: skjema, prompter, agent, steg, arbeider
src/app/api/jobs/      Arbeideren (beskyttet med JOB_SECRET)
```

## Sikkerhet

- Alle tabeller har Row Level Security, så hver bruker ser bare sine egne data.
- Funn og kilder kan bare skrives av bakgrunnsjobben, som bruker service-rollen.
- API-nøkler finnes bare i miljøvariabler på serveren. Kun `NEXT_PUBLIC_*` sendes til nettleseren.

## På iPad og mobil

Åpne appen i Safari, trykk Del-knappen og velg «Legg til på Hjem-skjerm». Da får Aksjeinnsikt et eget ikon og åpnes som en app.
