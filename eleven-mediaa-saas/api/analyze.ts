import type { VercelRequest, VercelResponse } from '@vercel/node';

type AnalysisType = 'geo' | 'aha' | 'semantic';

interface AnalysisResult {
  score: number;
  aiVerdict: string;
  missingElements: string[];
}

const BASE_ROLE =
  'Eres un consultor senior de Growth para B2B SaaS, especialista en Product-Led Growth (PLG), ' +
  'Answer Engine Optimization (AEO/GEO) y arquitectura semantica de contenido. ' +
  'Analizas UNICAMENTE el texto que te entrega el usuario. No inventes datos, no asumas metricas. ' +
  'Se critico y especifico. Escribe en espanol neutro profesional.';

const OUTPUT_CONTRACT =
  'Devuelve EXCLUSIVAMENTE un objeto JSON valido con esta forma exacta: ' +
  '{"score": <entero 0-100, calibrado; la mayoria de textos reales caen entre 25 y 65>, ' +
  '"aiVerdict": "<2-4 frases, diagnostico directo, sin saludos>", ' +
  '"missingElements": ["<paso accionable 1>", "<paso accionable 2>", "<paso accionable 3>"]}. ' +
  'Exactamente 3 elementos en missingElements, cada uno en imperativo y de maximo 220 caracteres. ' +
  'No incluyas markdown ni texto fuera del JSON.';

const SPECIFICS: Record<AnalysisType, string> = {
  geo:
    'TIPO DE ANALISIS: Simulador GEO / Perplexity. Evalua si un motor de respuestas con IA ' +
    '(ChatGPT, Perplexity, Google AI Overviews) recomendaria este producto cuando alguien describe ' +
    'el problema que resuelve. Criterios: claridad del problema y del ICP; entidades citables ' +
    '(categoria, casos de uso, diferenciadores verificables); afirmaciones autocontenidas que una IA ' +
    'pueda citar; especificidad frente a marketing vacio. El score baja fuerte si el texto es generico ' +
    'o intercambiable con el de cualquier competidor.',
  aha:
    'TIPO DE ANALISIS: Friccion del Aha-Moment. Evalua cuanto tarda un usuario nuevo en percibir valor ' +
    'real segun esta descripcion u onboarding. Criterios: time-to-value; cantidad de pasos y decisiones ' +
    'antes del primer resultado util; presencia de datos de ejemplo o plantillas que eviten el empty state; ' +
    'conexion entre el valor prometido y la primera accion. El score baja fuerte si se pide setup, ' +
    'integraciones o importaciones antes de mostrar valor.',
  semantic:
    'TIPO DE ANALISIS: Auditoria Semantica. Evalua la cobertura de entidades y conceptos necesarios para ' +
    'dominar busquedas long-tail en esta categoria. Criterios: cobertura del topic cluster; modificadores ' +
    'long-tail (casos de uso, integraciones, roles, alternativas, comparativas); profundidad semantica ' +
    'frente a repeticion de keyword; vacios que impiden posicionar en intencion informacional y comparativa. ' +
    'El score baja fuerte si solo describe features sin conectar con problemas ni con lenguaje de busqueda real.',
};

function buildPrompt(t: AnalysisType, name: string, desc: string): string {
  return (
    BASE_ROLE +
    '\n\n' +
    SPECIFICS[t] +
    '\n\nDATOS DEL USUARIO (unica fuente de verdad):\nNombre del SaaS: ' +
    name +
    '\nTexto a analizar:\n' +
    desc +
    '\n\n' +
    OUTPUT_CONTRACT
  );
}

function safeParse(rawText: string): AnalysisResult {
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const candidate = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;

  const parsed = JSON.parse(candidate);

  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));

  const aiVerdict =
    typeof parsed.aiVerdict === 'string' && parsed.aiVerdict.trim()
      ? parsed.aiVerdict.trim()
      : 'No fue posible generar un diagnostico con el texto entregado.';

  const missingElements = Array.isArray(parsed.missingElements)
    ? parsed.missingElements
        .filter(function (i: unknown) {
          return typeof i === 'string' && i.trim().length > 0;
        })
        .slice(0, 3)
    : [];

  return { score: score, aiVerdict: aiVerdict, missingElements: missingElements };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido. Usa POST.' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Falta la variable de entorno GEMINI_API_KEY.' });
    }

    let body: any = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }
    if (!body) {
      body = {};
    }

    const saasName = String(body.saasName || '').trim();
    const description = String(body.description || '').trim();
    const analysisType = String(body.analysisType || '') as AnalysisType;

    if (!saasName || !description) {
      return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    }
    if (description.length < 40) {
      return res.status(400).json({ error: 'La descripcion es demasiado corta (minimo 40 caracteres).' });
    }
    if (analysisType !== 'geo' && analysisType !== 'aha' && analysisType !== 'semantic') {
      return res.status(400).json({ error: 'Tipo de analisis no valido.' });
    }

    const prompt = buildPrompt(analysisType, saasName.slice(0, 120), description.slice(0, 6000));

    const models = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];
    
    let rawText = '';
    let lastError = '';

    for (let i = 0; i < models.length; i++) {
      try {
        const url =
          'https://generativelanguage.googleapis.com/v1beta/models/' +
          models[i] +
          ':generateContent?key=' +
          apiKey;

        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 2000,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (!r.ok) {
          lastError = 'HTTP ' + r.status + ' en ' + models[i];
          console.error('[analyze] ' + lastError);
          continue;
        }

        const j: any = await r.json();
        const text = j && j.candidates && j.candidates[0] && j.candidates[0].content
          && j.candidates[0].content.parts && j.candidates[0].content.parts[0]
          ? j.candidates[0].content.parts[0].text
          : '';

        if (text) {
          rawText = text;
          console.log('[analyze] OK con ' + models[i]);
          break;
        }
        lastError = 'Respuesta vacia de ' + models[i];
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        console.error('[analyze] Fallo ' + models[i] + ': ' + lastError);
      }
    }

    if (!rawText) {
      const busy = lastError.indexOf('503') !== -1 || lastError.indexOf('overload') !== -1;
      return res.status(503).json({
        error: busy
          ? 'Los servidores de IA estan saturados. Espera unos segundos y vuelve a intentarlo.'
          : 'No pudimos completar el analisis. Detalle: ' + lastError,
      });
    }

    let payload: AnalysisResult;
    try {
      payload = safeParse(rawText);
    } catch (e) {
      console.error('[analyze] No parseable:', rawText);
      return res.status(502).json({ error: 'Respuesta inesperada del motor de analisis.' });
    }

    if (payload.missingElements.length === 0) {
      return res.status(502).json({ error: 'Analisis incompleto. Intenta con una descripcion mas detallada.' });
    }

    return res.status(200).json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[analyze] Error inesperado:', msg);
    return res.status(500).json({ error: 'Error interno: ' + msg });
  }
}
