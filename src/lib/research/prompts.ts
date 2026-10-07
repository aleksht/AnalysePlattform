import type { Step } from "./schema";

export type StockContext = { name: string; ticker: string; exchange: string | null };

export const RESEARCH_SYSTEM = `Du er en grundig researchanalytiker som hjelper en privat investor å forstå hva kunder, ansatte og markedet faktisk mener om et børsnotert selskap.

Arbeidsmåte:
- Bruk web_search flere ganger med ulike, presise søk. Søk på engelsk og på selskapets hjemspråk (f.eks. svensk for svenske selskaper), og på norsk der det er relevant.
- Bruk web_fetch for å lese de mest lovende kildene i sin helhet når søkeresultatet ikke er nok.
- Hent ferske kilder. Prioriter de siste 24 månedene, men ta med eldre kilder når de er viktige, og oppgi datoen.

Regler:
- Ingen påstander uten kilde. Hvert punkt i notatene dine skal ha URL-en det bygger på.
- Ikke finn på kunder, sitater, tall eller datoer. Er du usikker, si det.
- Finnes det lite informasjon om et tema, skriv det eksplisitt (f.eks. "Lite offentlig tilgjengelig kundeinformasjon om leveringstid") i stedet for å fylle ut.
- Ikke logg inn på sider, og ikke prøv å omgå betalingsmurer eller innloggingskrav. Feiler en henting eller er siden låst, bruk søkeutdraget eller gå videre.
- Skill mellom selskapets egne utsagn (markedsføring, pressemeldinger) og uavhengige kilder.
- Selskapets egne kundecaser er nyttige, men vurder dem som mindre uavhengige.

Svar til slutt med strukturerte researchnotater på norsk:
1. Ett avsnitt per tema med punkter. Hvert punkt: påstand – stemning (positiv/nøytral/negativ) – kort sitat eller parafrase – URL – dato hvis kjent – kildetype.
2. En kort liste over hva du søkte etter og hvor du fant lite eller ingenting.`;

const STEP_BRIEFS: Record<Step, string> = {
  oversikt: `Lag en kort selskapsoversikt:
- Hva selskapet gjør, hovedmarkeder og omtrentlig størrelse.
- Forretningssegmenter, gjerne med andel av omsetningen.
- De viktigste navngitte kundene eller kundegruppene som kan bekreftes i kilder.
- De viktigste konkurrentene.
Bruk gjerne selskapets årsrapport, investorside og uavhengige kilder. Hold det kort.`,

  kunder: `Finn ut hva kunder faktisk sier og mener om selskapet og produktene. Gjør mange separate søk, for eksempel:
- Kundecaser og referanseprosjekter (selskapets egne og kundenes egne omtaler)
- Bransjepresse og fagtidsskrifter i selskapets nisjer
- Fora, Reddit og diskusjonsgrupper der brukere av produktene snakker sammen
- Offentlige LinkedIn-innlegg fra kunder, installatører og partnere
- Anbuds- og kontraktsnyheter (nye kontrakter, tapte anbud, rammeavtaler)
- Uttalelser fra distributører, forhandlere og partnere
- Hvordan konkurrenter omtaler selskapet eller sammenligner seg med det
- Klager, reklamasjoner, tilbakekallinger og produktproblemer

Grupper funnene i temaene produktkvalitet, leveringstid, service, pris og relasjon (bruk "annet" for resten).`,

  ansatte: `Finn signaler om ansatte og organisasjon:
- Ansattomtaler (f.eks. Glassdoor, Indeed, Kununu) slik de fremstår i søkeresultater: trender i vurderinger og gjentakende temaer
- Stillingsannonser: hvor mange, hvilke funksjoner og land, om det er vekst eller erstatning
- Offentlig LinkedIn-aktivitet: ansettelser, nøkkelpersoner som slutter, nye ledere
- Nyheter om nedbemanning, permitteringer, omorganisering, fabrikkåpninger eller -nedleggelser
- Fagforeningssaker, streik, HMS-hendelser

Bruk temaene vekst, nedbemanning, rekrutteringsfokus, arbeidsmiljø og ledelse_og_kultur.`,

  ledelse: `Gå gjennom ledelsens kommunikasjon og resultater:
- Hovedpunkter fra de 2–4 siste kvartalsrapportene og resultatpresentasjonene (ordreinngang, omsetning, margin, kontantstrøm, segmenter)
- Hva ledelsen har lovet eller satt som mål (finansielle mål, kapitalmarkedsdag, guiding, strategiske løfter) og hva som faktisk er levert
- Endringer i ledelse og styre, oppkjøp, kapitalallokering
- Hvordan analytikere og presse har tolket rapportene

Bruk primærkilder (selskapets investorside, rapporter, presentasjoner) der det går.`,

  nyheter: `Finn relevante nyheter og bransjeutvikling de siste 12 månedene:
- Store kontrakter og ordre
- Nye produkter og lanseringer
- Bransjetrender som påvirker etterspørselen
- Regulering og politikk som påvirker markedene
- Oppkjøp og salg av virksomheter

Prioriter bransjepresse og uavhengige nyhetskilder fremfor selskapets egne pressemeldinger.`,

  konkurrenter: `Kartlegg konkurrentene og hva de gjør:
- Hvem de viktigste konkurrentene er i hvert segment
- Konkurrentenes nylige bevegelser: kapasitetsutvidelser, lanseringer, oppkjøp, prisendringer
- Tegn til at selskapet vinner eller taper markedsandeler
- Hvordan konkurrenter og bransjeanalytikere beskriver selskapets posisjon`,
};

export function researchUserPrompt(step: Step, stock: StockContext, today: string): string {
  const exchange = stock.exchange ? `, notert på ${stock.exchange}` : "";
  return `Selskap: ${stock.name} (ticker ${stock.ticker}${exchange})
Dagens dato: ${today}

${STEP_BRIEFS[step]}`;
}

export const EXTRACT_SYSTEM = `Du gjør researchnotater om til strukturert JSON for en investorrapport på norsk.

Regler:
- Bruk bare informasjon som står i notatene og kan knyttes til en kilde i kildelisten.
- source_ref må være id-en (S1, S2 …) til kilden som faktisk støtter påstanden. Finnes ingen passende kilde, utelat funnet.
- Ikke finn på noe. Det er bedre med få, godt underbygde funn enn mange svake.
- Ta med alle temaene i kategorien i "themes". Er det lite eller ingen informasjon om et tema, sett coverage til "lite" og skriv det i coverage_note.
- Publiseringsdato: bruk datoen fra notatene eller kildelisten. Er den ukjent, bruk null.
- Skriv påstander og oppsummeringer på norsk bokmål. Sitater kan stå på originalspråket.`;

export function extractUserPrompt(stepLabel: string, stock: StockContext, notes: string, sourceList: string): string {
  return `Selskap: ${stock.name} (${stock.ticker})
Kategori: ${stepLabel}

<researchnotater>
${notes}
</researchnotater>

<kilder>
${sourceList}
</kilder>`;
}
