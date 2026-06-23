import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Helper to get Gemini client lazily
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined. Please configure it in your environment or Secrets menu.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Robust fallback runner to handle 503 or model unavailability
async function generateContentWithFallback(ai: GoogleGenAI, config: { contents: string; config: any }) {
  const models = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-2.5-pro", "gemini-1.5-flash"];
  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`Tentando executar requisição com o modelo: ${model}`);
      const response = await ai.models.generateContent({
        model: model,
        contents: config.contents,
        config: config.config
      });
      console.log(`Requisição bem-sucedida usando o modelo: ${model}`);
      return response;
    } catch (err: any) {
      console.warn(`Aviso: Falha com o modelo ${model}. Detalhes: ${err.message || JSON.stringify(err)}. Tentando próximo fallback...`);
      lastError = err;
      // Do not try another model if it's a authorization error
      if (err.status === 401 || err.status === 403 || (err.message && err.message.includes("API key"))) {
        throw err;
      }
    }
  }

  throw lastError || new Error("Todos os modelos de IA disponíveis falharam na execução.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" }));

  // API Route: AI Detection
  app.post("/api/detect", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string" || text.trim().length < 10) {
        return res.status(400).json({
          error: "O texto para detecção deve ter pelo menos 10 caracteres."
        });
      }

      // Check key
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: "Chave API do Gemini ausente. Por favor, configure a variável 'GEMINI_API_KEY' nas Configurações de Segredos (Settings > Secrets) do AI Studio."
        });
      }

      const ai = getGeminiClient();

      const prompt = `Analise detalhadamente o seguinte texto para detectar se foi escrito por Inteligência Artificial (como ChatGPT, Gemini, Claude, etc.) ou se é humano.
Foque na perplexidade (previsibilidade de palavras), burstiness (variação do tamanho e estrutura das sentenças), uso de jargões típicos de IA e padrões repetitivos.

Divida o texto em sentenças lógicas e atribua uma probabilidade aproximada de IA para cada sentença individual de forma justa.

Texto para análise:
"""
${text}
"""`;

      const response = await generateContentWithFallback(ai, {
        contents: prompt,
        config: {
          systemInstruction: "Você é um especialista em linguística computacional e detecção de conteúdos gerados por inteligência artificial. Sua análise deve ser minuciosa, equilibrada e justa, assemelhando-se aos melhores detectores do mercado como Turnitin e GPTZero. Você deve retornar estritamente uma resposta estruturada em formato JSON.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: {
                type: Type.INTEGER,
                description: "Probabilidade geral de IA em porcentagem (0 a 100, onde 100 é certeza absoluta de IA e 0 é certeza de humano)."
              },
              verdict: {
                type: Type.STRING,
                description: "Veredito resumido, ex: 'Altamente Provável de ser Humano', 'Possível Escrita por IA ou Editado', 'Altamente Provável de ser IA'."
              },
              summary: {
                type: Type.STRING,
                description: "Uma explicação em português detalhando por que o texto recebeu essa nota, apontando as principais características observadas."
              },
              metrics: {
                type: Type.OBJECT,
                properties: {
                  perplexity: {
                    type: Type.INTEGER,
                    description: "Previsibilidade do vocabulário (0 a 100, onde 100 significa escrita extremamente comum/previsível típica de IA)."
                  },
                  burstiness: {
                    type: Type.INTEGER,
                    description: "Variação na estrutura e tamanho das frases (0 a 100, onde 100 significa variação perfeita/humana e 0 significa uniformidade total típica de IA)."
                  },
                  repetition: {
                    type: Type.INTEGER,
                    description: "Nível de repetição de estruturas e conectores de transição típicos de IA (0 a 100)."
                  },
                  vocabulary: {
                    type: Type.INTEGER,
                    description: "Diversidade vocabular (0 a 100)."
                  }
                },
                required: ["perplexity", "burstiness", "repetition", "vocabulary"]
              },
              sentences: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING, description: "A frase ou oração analisada." },
                    score: { type: Type.INTEGER, description: "Probabilidade de IA para esta frase específica (0 a 100)." }
                  },
                  required: ["text", "score"]
                },
                description: "Análise frase por frase do texto. Certifique-se de incluir todas as sentenças do texto original, sem omitir nenhuma parte relevante."
              },
              clues: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Lista de pistas linguísticas detectadas (ex: 'Uso excessivo de conectores formais', 'Falta de voz ativa', 'Sentenças com tamanhos idênticos')."
              },
              tips: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Conselhos práticos e específicos para tornar este texto mais humano e natural."
              }
            },
            required: ["score", "verdict", "summary", "metrics", "sentences", "clues", "tips"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Não foi possível obter resposta do modelo de IA.");
      }

      const result = JSON.parse(responseText);
      res.json(result);

    } catch (error: any) {
      console.error("Erro na detecção de IA:", error);
      res.status(500).json({
        error: "Ocorreu um erro ao processar a detecção de IA.",
        details: error.message
      });
    }
  });

  // API Route: Humanize Text
  app.post("/api/humanize", async (req, res) => {
    try {
      const { text, mode, intensity, language } = req.body;
      if (!text || typeof text !== "string" || text.trim().length < 10) {
        return res.status(400).json({
          error: "O texto para humanização deve ter pelo menos 10 caracteres."
        });
      }

      // Check key
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: "Chave API do Gemini ausente. Por favor, configure a variável 'GEMINI_API_KEY' nas Configurações de Segredos (Settings > Secrets) do AI Studio."
        });
      }

      const ai = getGeminiClient();

      // Configure prompt based on mode & intensity
      // Modes: academic (acadêmico), narrative (narrativo/histórias), conversational (conversacional/coloquial), professional (corporativo/formal)
      // Intensity: standard (padrão), high (avançado - muda bastante a estrutura para passar em testes ultra rígidos como Turnitin)
      const targetModeStr = mode === "academic" ? "Acadêmico (mantendo rigor metodológico, referências implícitas e precisão, mas com fluxo humano dinâmico e natural)" :
                            mode === "narrative" ? "Narrativo / Criativo (com storytelling, linguagem descritiva rica e ritmos variados)" :
                            mode === "conversational" ? "Conversacional / Coloquial (descontraído, com expressões idiomáticas, tom direto, voz ativa forte e variações cotidianas)" :
                            "Profissional / Corporativo (claro, elegante, direto ao ponto, evitando clichês corporativos robóticos)";

      const intensityStr = intensity === "high" ? "Intensidade Avançada: Reestruture pesadamente as frases. Mude a ordem sintática, quebre clichês previsíveis, use vocabulários ricos e rústicos, intercale sentenças de 3 palavras com sentenças longas, introduza nuances emocionais ou lógicas sutis para passar completamente por Turnitin v2, GPTZero e CopyLeaks." :
                           "Intensidade Moderada: Altere termos comuns por sinônimos contextualizados, varie o ritmo de pontuação e remova os conectores clichês de IA (como 'em suma', 'além disso', 'é importante destacar').";

      const prompt = `Humanize o seguinte texto para que ele pareça 100% escrito por um ser humano real, garantindo que ele passe sem ser detectado por softwares de detecção de IA (como Turnitin, GPTZero, ZeroGPT, CopyLeaks).

Estilo de Escrita Alvo: ${targetModeStr}
Nível de Intervenção: ${intensityStr}
Idioma do Texto de Destino: ${language || 'Português'}

Instruções fundamentais para passar em detectores rigorosos:
1. **Ritmo de Sentenças Humano (Burstiness)**: Intercale frases muito curtas (frases de impacto, perguntas retóricas) com períodos mais longos e compostos. A inteligência artificial tende a escrever frases com tamanhos de caracteres quase uniformes.
2. **Vocabulário Imprevisível (High Perplexity)**: Substitua palavras comuns e genéricas por termos menos prováveis, expressões idiomáticas naturais e sinônimos refinados apropriados ao contexto.
3. **Erradique Clichês de IA**: Remova palavras e conectores de transição robóticos de alta frequência (como 'em suma', 'além disso', 'por fim', 'é crucial', 'vale ressaltar', 'primeiramente', 'em segundo lugar', 'outro aspecto relevante'). Use transições lógicas invisíveis ou conectores humanos casuais (como 'na prática', 'acontece que', 'com isso', 'olhando de perto', 'o resultado disso').
4. **Voz Ativa**: Prefira a voz ativa ('O pesquisador descobriu...') à voz passiva típica de IA ('Foi descoberto pelo pesquisador...').
5. **Autenticidade e Personalidade**: Introduza leveza e espontaneidade de raciocínio. O texto resultante deve ser coeso, gramaticalmente correto no idioma solicitado, extremamente profissional (ou adequado ao modo escolhido) e manter INTEGRALMENTE o significado, ideias e fatos originais do texto de entrada.

Texto original a ser humanizado:
"""
${text}
"""`;

      const response = await generateContentWithFallback(ai, {
        contents: prompt,
        config: {
          systemInstruction: "Você é um reescritor profissional de textos e especialista sênior em redação humana criativa e acadêmica. Seu único objetivo é reescrever o texto de entrada mantendo 100% de sua mensagem, fatos e precisão, mas convertendo todo o estilo de escrita para uma assinatura linguística perfeitamente humana que neutralize detectores de IA. Retorne o resultado em formato JSON.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              humanizedText: {
                type: Type.STRING,
                description: "O texto reescrito e humanizado de forma completa, sem nenhuma omissão de conteúdo original."
              },
              estimatedScore: {
                type: Type.INTEGER,
                description: "Nova probabilidade estimada de IA em porcentagem após a humanização (geralmente entre 1% e 8%)."
              },
              originalScore: {
                type: Type.INTEGER,
                description: "Estimativa da probabilidade inicial de IA do texto original antes de ser humanizado (0 a 100)."
              },
              explanations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING, description: "A categoria da alteração (ex: 'Ritmo Sintático', 'Substituição de Conectores', 'Voz Ativa')." },
                    description: { type: Type.STRING, description: "Explicação em português detalhando o que foi feito nesta categoria no texto." }
                  },
                  required: ["category", "description"]
                },
                description: "Relatório com as principais melhorias estruturais inseridas no texto para torná-lo humano."
              }
            },
            required: ["humanizedText", "estimatedScore", "originalScore", "explanations"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Não foi possível obter resposta do modelo de IA para humanização.");
      }

      const result = JSON.parse(responseText);
      res.json(result);

    } catch (error: any) {
      console.error("Erro na humanização de texto:", error);
      res.status(500).json({
        error: "Ocorreu um erro ao processar a humanização do texto.",
        details: error.message
      });
    }
  });

  // Serve static files and handle Vite routing
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
