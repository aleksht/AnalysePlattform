# Aksjeinnsikt

Webapp for aksjeresearch: hva kunder, ansatte og markedet faktisk mener om selskapene du vurderer.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres, Auth, RLS) · Anthropic API · Vercel

## Status

| Fase | Innhold | Status |
|---|---|---|
| 1 | Innlogging, mapper, aksjer, aksjeside med tomme faner | ✅ |
| 2 | Researchagent, lagring og visning av funn med kilder | – |
| 3 | Innsiktsmodus, trend over tid, ukentlig kjøring | – |
| 4 | Finpuss, feilhåndtering, kostnadsoversikt | – |

## Oppsett

### 1. Supabase

1. Lag et prosjekt i regionen **eu-north-1 (Stockholm)**.
2. Kjør migrasjonene i `supabase/migrations/` i rekkefølge. Bruk enten SQL Editor i dashbordet, eller `supabase link` og deretter `supabase db push`.
3. Gå til **Authentication → URL Configuration**:
   - Site URL: `https://<din-app>.vercel.app`
   - Redirect URLs: `https://<din-app>.vercel.app/auth/confirm` og `http://localhost:3000/auth/confirm`
4. Gå til **Authentication → Emails → Magic Link** og bytt malen ut med denne. Da virker lenken også når den åpnes på en annen enhet enn den du ba om den fra, og e-posten får en kode som kan skrives inn:

   ```html
   <h2>Logg inn på Aksjeinnsikt</h2>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Logg inn</a></p>
   <p>Eller skriv inn koden: <strong>{{ .Token }}</strong></p>
   ```

5. Hent nøklene under **Project Settings → API Keys**: én publishable-nøkkel og én secret-nøkkel.

### 2. Miljøvariabler

Kopier `.env.example` til `.env.local` og fyll ut verdiene. På Vercel legger du de samme variablene inn under **Settings → Environment Variables**.

`ALLOWED_EMAILS` bestemmer hvem som får logge inn. Er den tom, slipper alle inn, så den bør alltid være satt i produksjon.

### 3. Kjør lokalt

```bash
npm install
npm run dev
```

## Struktur

```
supabase/migrations/   SQL-migrasjoner (tabeller + RLS)
src/proxy.ts           Fornyer sesjonen, sender uinnloggede til /login
src/app/login          Innlogging med magisk lenke eller kode
src/app/auth/confirm   Mottar den magiske lenken
src/app/(app)/         Innloggede sider: oversikt, aksjeside, innstillinger
src/components/        UI-komponenter
src/lib/actions/       Server actions (validert med zod)
src/lib/supabase/      Supabase-klienter
```

## Sikkerhet

- Alle tabeller har Row Level Security, så hver bruker ser bare sine egne data.
- Funn og kilder kan bare skrives av bakgrunnsjobben, som bruker service-rollen.
- API-nøkler finnes bare i miljøvariabler på serveren. Kun `NEXT_PUBLIC_*` sendes til nettleseren.
