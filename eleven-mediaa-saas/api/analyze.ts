    /* --- 3. Llamada a Gemini con presupuesto de tiempo --- */
    const genAI = new GoogleGenerativeAI(apiKey);
    const MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];

    const prompt = buildPrompt(analysisType, safeName, safeDescription);
    const DEADLINE = Date.now() + 8000; // margen sobre el límite de 10s de Vercel

    let raw = '';
    let lastError = '';
    let overloaded = false;

    for (const modelName of MODELS) {
      if (Date.now() > DEADLINE) break;
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 700,
            responseMimeType: 'application/json',
          },
        });

        // Corta el intento si un modelo se cuelga.
        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error('timeout del modelo')), 3500)
          ),
        ]);

        raw = (result as { response: { text: () => string } }).response.text();
        console.log(`[analyze] OK con ${modelName}`);
        break;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        overloaded = /503|overload|high demand|unavailable/i.test(lastError);
        console.error(`[analyze] Fallo ${modelName}: ${lastError}`);
      }
    }

    if (!raw) {
      return res.status(503).json({
        error: overloaded
          ? 'Los servidores de IA están saturados. Espera unos segundos y vuelve a intentarlo.'
          : `No pudimos completar el análisis. Detalle: ${lastError}`,
      });
    }
