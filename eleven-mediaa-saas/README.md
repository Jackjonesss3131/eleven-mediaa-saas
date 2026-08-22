# Auditor de Adquisición B2B SaaS — Eleven Mediaa

Herramienta gratuita de "Engineering as Marketing". Vite + React + TS + Tailwind
con una Vercel Serverless Function que hace **una sola** llamada a Gemini.
Sin scraping: todo se analiza a partir del texto que escribe el usuario.

## Instalación

```bash
npm install
```

Crea un archivo `.env.local` (para desarrollo con `vercel dev`):

```
GEMINI_API_KEY=tu_api_key
```

## Desarrollo

```bash
vercel dev     # levanta el frontend y la función /api/analyze
```

`npm run dev` solo levanta el frontend (la ruta /api no responderá).

## Deploy

```bash
vercel env add GEMINI_API_KEY
vercel --prod
```

## Notas sobre el límite de 10s (plan Hobby)

- Una única llamada a `gemini-2.0-flash`, `maxOutputTokens: 900`.
- Input recortado a 6000 caracteres en el backend.
- Cero peticiones a URLs externas del usuario. Latencia típica: 2-4s.

## Conectar el lead magnet

En `src/App.tsx`, función `handleUnlock`: descomenta el `fetch` y pega tu
webhook de Make.com o Airtable. El payload ya incluye email, nombre del SaaS,
tipo de análisis y score.
