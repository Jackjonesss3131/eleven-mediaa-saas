    /* --- 3. Llamada a Gemini con fallback de modelo y reintentos --- */
    const genAI = new GoogleGenerativeAI(apiKey);
    const MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];

    const prompt = buildPrompt(analysisType, safeName, safeDescription);
    let raw = '';
    let lastError = '';
    let overloaded = false;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // 2 pasadas sobre la lista de modelos. Tiempo máximo ~6s, dentro del límite de 10s.
    outer: for (let attempt = 0; attempt < 2; attempt++) {
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
          console.log(`[analyze] OK con ${modelName} (intento ${attempt + 1})`);
          break outer;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          overloaded = /503|overload|high demand|unavailable/i.test(lastError);
          console.error(`[analyze] Fallo ${modelName}: ${lastError}`);
        }
      }
      if (attempt === 0) await sleep(1200); // respiro antes de la segunda pasada
    }

    if (!raw) {
      return res.status(503).json({
        error: overloaded
          ? 'Los servidores de IA están saturados en este momento. Espera unos segundos y vuelve a intentarlo.'
          : `No pudimos completar el análisis. Detalle: ${lastError}`,
      });
    }
