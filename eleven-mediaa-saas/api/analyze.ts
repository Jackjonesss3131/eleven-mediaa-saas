import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

type AnalysisType = 'geo' | 'aha' | 'semantic';

interface AnalyzePayload {
  saasName?: string;
  description?: string;
  analysisType?: AnalysisType;
}

interface AnalysisResult {
  score: number;
  aiVerdict: string;
  missingElements: string[];
}

/* -------------------------------------------------------------------------- */
/* Prompts dinámicos por tipo de análisis                                     */
/* -------------------------------------------------------------------------- */

const BASE_ROLE = `Eres un consultor senior de Growth para B2B SaaS, especialista en Product-Led Growth (PLG),
Answer Engine Optimization (AEO/GEO) y arquitectura semántica de contenido.
Analizas ÚNICAMENTE el texto que te entrega el usuario. No inventes datos de la empresa,
no asumas métricas que no estén en el texto, no navegues por internet.
Sé crítico y específico: un diagnóstico genérico no tiene valor.
Escribe siempre en español neutro profesional.`;

const OUTPUT_CONTRACT = `Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta forma exacta:
{
  "score": number,            // entero 0-100, honesto y calibrado. La mayoría de textos reales caen entre 25 y 65.
  "aiVerdict": string,        // 2-4 frases. El diagnóstico principal, directo, sin rodeos ni saludos.
  "missingElements": string[] // EXACTAMENTE 3 strings. Cada uno es un paso accionable y concreto (máx. 220 caracteres),
                              // redactado en imperativo y aplicable esta misma semana.
}
No incluyas markdown, backticks, comentarios ni texto fuera del JSON.`;

function buildPrompt(
  analysisType: AnalysisType,
  saasName: string,
  description: string
): string {
  const specifics: Record<AnalysisType, string> = {
    geo: `TIPO DE ANÁLISIS: Simulador GEO / Perplexity.
Evalúa si un motor de respuestas con IA (ChatGPT, Perplexity, Google AI Overviews) recomendaría
este producto cuando un usuario describe el problema que resuelve.
Criterios de scoring:
- Claridad del problema resuelto y del segmento (ICP) explícito.
- Presencia de entidades citables: categoría de producto, casos de uso nombrados, diferenciadores verificables.
- Lenguaje extractable: afirmaciones autocontenidas que una IA puede citar sin contexto adicional.
- Señales de autoridad y especificidad vs. lenguaje de marketing vacío ("la mejor plataforma", "todo en uno").
El score baja fuerte si el texto es genérico o intercambiable con el de cualquier competidor.`,

    aha: `TIPO DE ANÁLISIS: Fricción del Aha-Moment.
Evalúa cuánto tarda un usuario nuevo en percibir valor real según esta descripción u onboarding.
Criterios de scoring:
- Time-to-value: ¿el primer paso descrito entrega un resultado o solo pide configuración?
- Cantidad de pasos, campos y decisiones antes del primer resultado útil.
- Presencia de datos de ejemplo, plantillas o modo demo que eviten el "empty state".
- Si el valor prometido está claramente conectado con la primera acción del usuario.
El score baja fuerte si el onboarding pide integraciones, importaciones o setup antes de mostrar valor.`,

    semantic: `TIPO DE ANÁLISIS: Auditoría Semántica.
Evalúa la cobertura de entidades y conceptos necesarios para dominar búsquedas long-tail
en esta categoría de producto.
Criterios de scoring:
- Cobertura del topic cluster: conceptos, sinónimos y entidades que la categoría exige.
- Presencia de modificadores long-tail: casos de uso, integraciones, roles, alternativas, comparativas.
- Profundidad semántica vs. repetición de la misma keyword.
- Vacíos evidentes de contenido que impiden posicionar en la intención informacional y comparativa.
El score baja fuerte si el texto solo describe features sin conectar con problemas ni con lenguaje de búsqueda real.`,
  };

  return `${BASE_ROLE}

${specifics[analysisType]}

DATOS ENTREGADOS POR EL USUARIO (única fuente de verdad):
- Nombre del SaaS: ${saasName}
- Texto a analizar (propuesta de valor / descripción / primer paso del onboarding):
"""
${description}
"""

${OUTPUT_CONTRACT}`;
}

/* -------------------------------------------------------------------------- */
/* Utilidades                                                                 */
/* -------------------------------------------------------------------------- */

const VALID_TYPES: AnalysisType[] = ['geo', 'aha', 'semantic'];

function safeParse(raw: string): AnalysisResult {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const candidate = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;

  const parsed = JSON.parse(candidate) as Partial<AnalysisResult>;

  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
  const aiVerdict =
    typeof parsed.aiVerdict === 'string' && parsed.aiVerdict.trim()
      ? parsed.aiVerdict.trim()
      : 'No fue posible generar un diagnóstico con el texto entregado.';
  const missingElements = Array.isArray(parsed.missingElements)
    ? parsed.missingElements.filter((i) => typeof i === 'string' && i.trim()).slice(0, 3)
    : [];

  return { score, aiVerdict, missingElements };
}

/* -------------------------------------------------------------------------- */
/* Handler                                                                    */
/* -------------------------------------------------------------------------- */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  try {
    /* --- 1. Validación de la variable de entorno --- */
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[analyze] GEMINI_API_KEY no está definida en el entorno.');
      return res.status(500).json({
        error:
          'El servicio de análisis no está configurado. Falta la variable de entorno GEMINI_API_KEY.',
      });
    }

    /* --- 2. Validación del payload --- */
    const body: AnalyzePayload =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};

    const saasName = (body.saasName ?? '').toString().trim();
    const description = (body.description ?? '').toString().trim();
    const analysisType = (body.analysisType ?? '') as AnalysisType;

    if (!saasName || !description) {
      return res
        .status(400)
        .json({ error: 'Faltan campos obligatorios: nombre del SaaS y descripción.' });
    }
    if (description.length < 40) {
      return res.status(400).json({
        error: 'La descripción es demasiado corta. Necesitamos al menos 40 caracteres para analizar.',
      });
    }
    if (!VALID_TYPES.includes(analysisType)) {
      return res.status(400).json({ error: 'Tipo de análisis no válido.' });
    }

    const safeDescription = description.slice(0, 6000);
    const safeName = saasName.slice(0, 120);

    /* --- 3. Llamada a Gemini con fallback de modelo --- */
    const genAI = new GoogleGenerativeAI(apiKey);
    const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];

    const prompt = buildPrompt(analysisType, safeName, safeDescription);
    let raw = '';
    let lastError = '';

    for (const modelName of MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 900,
            responseMimeType: 'application/json',
          },
        });
        const result = await model.generateContent(prompt);
        raw = result.response.text();
        console.log(`[analyze] OK con modelo: ${modelName}`);
        break;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        console.error(`[analyze] Fallo ${modelName}: ${lastError}`);
      }
    }

    if (!raw) {
      return res.status(502).json({
        error: `Gemini rechazó la petición. Detalle: ${lastError}`,
      });
    }

    /* --- 4. Parseo estricto --- */
    let payload: AnalysisResult;
    try {
      payload = safeParse(raw);
    } catch (parseError) {
      console.error('[analyze] Respuesta no parseable:', raw, parseError);
      return res.status(502).json({
        error: 'El motor de análisis devolvió una respuesta inesperada. Intenta de nuevo.',
      });
    }

    if (payload.missingElements.length === 0) {
      return res.status(502).json({
        error: 'El análisis quedó incompleto. Intenta de nuevo con una descripción más detallada.',
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[analyze] Error inesperado:', message);
    return res.status(500).json({ error: `Error interno: ${message}` });
  }
}
