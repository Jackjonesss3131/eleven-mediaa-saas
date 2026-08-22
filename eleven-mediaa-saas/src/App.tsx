import { useState } from 'react';

/* -------------------------------------------------------------------------- */
/* Tipos                                                                      */
/* -------------------------------------------------------------------------- */

type AnalysisType = 'geo' | 'aha' | 'semantic';

interface AnalysisResult {
  score: number;
  aiVerdict: string;
  missingElements: string[];
}

const ANALYSIS_OPTIONS: {
  value: AnalysisType;
  label: string;
  helper: string;
  placeholder: string;
}[] = [
  {
    value: 'geo',
    label: 'Simulador GEO / Perplexity',
    helper: '¿Recomendará la IA tu producto cuando alguien describa el problema que resuelves?',
    placeholder:
      'Pega aquí tu propuesta de valor tal como aparece en tu home. Ej: "Somos la plataforma que ayuda a equipos de RRHH a automatizar el onboarding..."',
  },
  {
    value: 'aha',
    label: 'Fricción del Aha-Moment',
    helper: '¿Qué tan rápido percibe el valor un usuario nuevo según tu onboarding?',
    placeholder:
      'Describe el primer paso real del onboarding: qué ve el usuario al registrarse, qué le pides, cuántos pasos hay antes del primer resultado útil.',
  },
  {
    value: 'semantic',
    label: 'Auditoría Semántica',
    helper: '¿Qué conceptos te faltan para dominar las búsquedas long-tail de tu categoría?',
    placeholder:
      'Pega la descripción de tu producto o categoría: qué hace, para quién, con qué se integra y contra qué compites.',
  },
];

const SCORE_BANDS = [
  { min: 75, label: 'Sólido', tone: 'text-emerald-400', bar: 'bg-emerald-400' },
  { min: 50, label: 'Mejorable', tone: 'text-amber-400', bar: 'bg-amber-400' },
  { min: 0, label: 'Crítico', tone: 'text-rose-400', bar: 'bg-rose-400' },
];

function getBand(score: number) {
  return SCORE_BANDS.find((b) => score >= b.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
}

const FREE_EMAIL_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'icloud.com',
  'live.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
];

function isCorporateEmail(email: string): boolean {
  const match = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/.exec(email.trim().toLowerCase());
  if (!match) return false;
  return !FREE_EMAIL_DOMAINS.includes(match[1]);
}

/* -------------------------------------------------------------------------- */
/* Componente principal                                                       */
/* -------------------------------------------------------------------------- */

export default function App() {
  const [saasName, setSaasName] = useState('');
  const [description, setDescription] = useState('');
  const [analysisType, setAnalysisType] = useState<AnalysisType>('geo');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [submittingLead, setSubmittingLead] = useState(false);

  const activeOption =
    ANALYSIS_OPTIONS.find((o) => o.value === analysisType) ?? ANALYSIS_OPTIONS[0];

  const formValid = saasName.trim().length > 1 && description.trim().length >= 40;

  /* --- Envío del análisis --- */
  async function handleAnalyze() {
    if (!formValid || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setUnlocked(false);
    setEmail('');
    setEmailError(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saasName: saasName.trim(),
          description: description.trim(),
          analysisType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? 'No pudimos completar el análisis. Intenta de nuevo.');
        return;
      }

      setResult(data as AnalysisResult);
      // Scroll suave hacia los resultados en móvil.
      setTimeout(() => {
        document.getElementById('resultados')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch {
      setError('Error de conexión. Verifica tu red e intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }

  /* --- Compuerta de valor (lead magnet) --- */
  async function handleUnlock() {
    if (submittingLead) return;

    if (!isCorporateEmail(email)) {
      setEmailError('Ingresa un correo corporativo válido (no aceptamos Gmail, Hotmail, etc.).');
      return;
    }

    setEmailError(null);
    setSubmittingLead(true);

    // TODO: conectar a webhook de Make.com / Airtable.
    // await fetch('https://hook.make.com/XXXXXXXX', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ email, saasName, analysisType, score: result?.score }),
    // });
    await new Promise((r) => setTimeout(r, 700)); // simulación del envío

    setSubmittingLead(false);
    setUnlocked(true);
  }

  /* ------------------------------------------------------------------------ */

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased">
      {/* Fondo decorativo */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.10),transparent_55%)]" />

      <div className="relative mx-auto max-w-3xl px-5 py-14 sm:py-20">
        {/* ---------------- Header ---------------- */}
        <header className="mb-12 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs font-medium tracking-wide text-sky-400">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            Eleven Mediaa · Herramienta gratuita
          </span>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Auditor de Adquisición para B2B SaaS
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-400">
            Descubre en 15 segundos por qué la IA no te recomienda, dónde pierdes usuarios en el
            onboarding y qué conceptos te faltan para posicionar. Sin registro para ver tu
            diagnóstico.
          </p>
        </header>

        {/* ---------------- Formulario ---------------- */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/40 sm:p-8">
          <div className="space-y-6">
            {/* Nombre */}
            <div>
              <label htmlFor="saasName" className="mb-2 block text-sm font-medium text-slate-200">
                Nombre de tu SaaS
              </label>
              <input
                id="saasName"
                type="text"
                value={saasName}
                onChange={(e) => setSaasName(e.target.value)}
                placeholder="Ej: Linear, Notion, TuProducto"
                maxLength={120}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            {/* Tipo de análisis */}
            <div>
              <label
                htmlFor="analysisType"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Tipo de análisis
              </label>
              <select
                id="analysisType"
                value={analysisType}
                onChange={(e) => setAnalysisType(e.target.value as AnalysisType)}
                className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              >
                {ANALYSIS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{activeOption.helper}</p>
            </div>

            {/* Descripción */}
            <div>
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Propuesta de valor, descripción u onboarding
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={activeOption.placeholder}
                rows={6}
                maxLength={6000}
                className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-relaxed text-slate-100 placeholder-slate-600 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>Mínimo 40 caracteres.</span>
                <span>{description.trim().length} / 6000</span>
              </div>
            </div>

            {/* CTA */}
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!formValid || loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-5 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-90"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Analizando...
                </>
              ) : (
                'Analizar gratis'
              )}
            </button>

            {error && (
              <p className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
                {error}
              </p>
            )}
          </div>
        </section>

        {/* ---------------- Resultados ---------------- */}
        {result && (
          <section id="resultados" className="mt-8 space-y-6">
            {/* Score + veredicto (gratis) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
                    Score de {activeOption.label}
                  </p>
                  <p className="mt-2 text-5xl font-bold tabular-nums">
                    {result.score}
                    <span className="text-2xl text-slate-600">/100</span>
                  </p>
                </div>
                <span
                  className={`mt-1 rounded-full border border-slate-800 px-3 py-1 text-xs font-semibold ${getBand(result.score).tone}`}
                >
                  {getBand(result.score).label}
                </span>
              </div>

              <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${getBand(result.score).bar}`}
                  style={{ width: `${result.score}%` }}
                />
              </div>

              <div className="mt-7 border-t border-slate-800 pt-6">
                <p className="mb-3 text-xs font-medium uppercase tracking-widest text-slate-500">
                  Diagnóstico
                </p>
                <p className="text-base leading-relaxed text-slate-200">{result.aiVerdict}</p>
              </div>
            </div>

            {/* Compuerta de valor */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8">
              <p className="mb-1 text-xs font-medium uppercase tracking-widest text-slate-500">
                Plan de acción
              </p>
              <h2 className="text-lg font-semibold text-slate-100">
                Los 3 pasos concretos para cerrar esta brecha
              </h2>

              {!unlocked ? (
                <>
                  {/* Preview borroso */}
                  <div className="relative mt-5 select-none">
                    <div className="space-y-3 blur-[6px]" aria-hidden="true">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-slate-800 bg-slate-950/70 p-4"
                        >
                          <div className="mb-2 h-3 w-2/3 rounded bg-slate-700" />
                          <div className="h-3 w-full rounded bg-slate-800" />
                        </div>
                      ))}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/80" />
                  </div>

                  {/* Formulario de correo */}
                  <div className="mt-6 rounded-xl border border-sky-900/50 bg-sky-950/20 p-5">
                    <p className="text-sm leading-relaxed text-slate-300">
                      Ingresa tu correo corporativo y desbloquea el plan de acción al instante.
                      También te enviamos una copia del informe.
                    </p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                        placeholder="tu@empresa.com"
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                      />
                      <button
                        type="button"
                        onClick={handleUnlock}
                        disabled={submittingLead}
                        className="rounded-lg bg-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                      >
                        {submittingLead ? 'Enviando...' : 'Desbloquear'}
                      </button>
                    </div>
                    {emailError && <p className="mt-3 text-sm text-rose-400">{emailError}</p>}
                    <p className="mt-3 text-xs text-slate-500">
                      Sin spam. Puedes darte de baja en un clic.
                    </p>
                  </div>
                </>
              ) : (
                <div className="mt-5 space-y-3">
                  {result.missingElements.map((item, i) => (
                    <div
                      key={i}
                      className="flex gap-4 rounded-lg border border-slate-800 bg-slate-950/70 p-4"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sm font-semibold text-sky-400">
                        {i + 1}
                      </span>
                      <p className="text-sm leading-relaxed text-slate-200">{item}</p>
                    </div>
                  ))}

                  <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/70 p-5 text-center">
                    <p className="text-sm text-slate-300">
                      ¿Quieres que ejecutemos esto contigo?
                    </p>
                    <a
                      href="https://elevenmediaa.com/contacto"
                      className="mt-3 inline-block rounded-lg border border-sky-500/50 px-5 py-2.5 text-sm font-semibold text-sky-400 transition hover:bg-sky-500/10"
                    >
                      Agendar diagnóstico con Eleven Mediaa
                    </a>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ---------------- Footer ---------------- */}
        <footer className="mt-16 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} Eleven Mediaa · Análisis generado con IA sobre el texto que
          proporcionas. No rastreamos ni visitamos tu sitio web.
        </footer>
      </div>
    </div>
  );
}
