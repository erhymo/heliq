# Heliq

Scheduleplanlegger og scheduleviser for helikopterpiloter og lastemann/TS.

## Lokal utvikling

1. Kopier `.env.local.example` til `.env.local` og fyll inn egne verdier.
2. Kjør `npm run dev`.
3. Åpne `/admin` for admin og `/min-plan` for pilot/TS.

Uten Firebase-miljøvariabler bruker appen lokal demo-lagring i `data/heliq.local.json`.

## Deploy-retning

- Vercel hoster Next.js-appen.
- Firebase/Firestore lagrer Heliq-data.
- Firestore-regler stenger klienttilgang; server-API bruker Firebase Admin SDK.

## Demo-login

- Admin lokalt: `heliq-admin` hvis `HELIQ_ADMIN_PASSWORD` ikke er satt.
- Pilot-demo: `1001`, `1002`, `1003`.
- TS-demo: `2001`, `2002`.
