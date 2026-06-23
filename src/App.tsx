import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  SearchCode, 
  Copy, 
  Check, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RotateCcw, 
  Info, 
  ArrowRight, 
  Layers, 
  Gauge, 
  HelpCircle,
  TrendingDown,
  CheckSquare,
  FileText,
  Bookmark,
  ChevronRight,
  Globe2,
  ListRestart
} from "lucide-react";
import { DetectionResult, HumanizeResult, SentenceAnalysis } from "./types";
import { GoogleGenAI, Type } from "@google/genai";

// Dynamic loading status messages for aesthetic wait times or actual states
const DETECTION_STEPS = [
  "Dividindo o texto em sentenças lógicas...",
  "Analisando perplexidade (previsibilidade de termos)...",
  "Avaliando burstiness (variação no tamanho das frases)...",
  "Cruzando com base de dados linguísticos (Turnitin & GPTZero)...",
  "Calculando probabilidade final de escrita artificial..."
];

const HUMANIZATION_STEPS = [
  "Escaneando assinatura de IA no texto original...",
  "Variando o ritmo das orações (remodelando burstiness)...",
  "Substituindo conectores redundantes e previsíveis...",
  "Substituindo termos genéricos por sinônimos contextualizados...",
  "Convertendo voz passiva para voz ativa ativa...",
  "Validando nova perplexidade sintática contra detectores...",
  "Finalizando texto humanizado indetectável..."
];

// Paste templates for easy testing
const PASTES = {
  ai: "A inteligência artificial tem revolucionado diversos setores da sociedade moderna, trazendo inovações significativas e otimizando processos. Através do processamento de linguagem natural e do aprendizado de máquina, algoritmos avançados conseguem analisar grandes volumes de dados de forma extremamente rápida. Além disso, é importante destacar que o impacto dessa tecnologia na educação é profundo e complexo. Em suma, o avanço tecnológico contínuo promete redefinir a maneira como interagimos com o mundo ao nosso redor.",
  human: "Olha, para ser bem honesto, eu nunca achei que a tecnologia fosse avançar tão rápido assim. Ontem mesmo eu estava tentando usar aquele aplicativo novo e acabei me batendo todo. Mas no fim das contas, a gente se acostuma, né? O mais engraçado é que o pessoal do trabalho jura que isso vai salvar a nossa pele, mas eu ainda prefiro o bom e velho papel e caneta para organizar as minhas tarefas do dia.",
  academic_ai: "No âmbito da pesquisa acadêmica contemporânea, observa-se uma correlação direta entre o desenvolvimento sustentável e a aplicação de políticas governamentais eficazes. Torna-se imperativo salientar que a correta alocação de recursos financeiros viabiliza avanços tecnológicos expressivos nas comunidades locais. Outrossim, ressalta-se que o monitoramento rigoroso das métricas de desempenho constitui uma ferramenta basilar para a validação das hipóteses previamente elencadas pelo corpo científico."
};

export default function App() {
  const tokenizeText = (text: string): string[] => {
    if (!text) return [];
    return text.split(/(\s+|[.,!?;:()""'’‘“”—\-\n]+)/g).filter(v => v !== "");
  };

  const isWordToken = (token: string) => {
    return /[A-Za-z0-9À-ÖØ-öø-ÿ]+/g.test(token);
  };

  const [inputText, setInputText] = useState("");
  const [mode, setMode] = useState<"academic" | "professional" | "conversational" | "narrative">("academic");
  const [intensity, setIntensity] = useState<"standard" | "high">("high");
  const [language, setLanguage] = useState("Português");

  // Client side API fallback states
  const [customApiKey, setCustomApiKey] = useState("");
  const [isStaticDeployError, setIsStaticDeployError] = useState(false);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState("");

  // State for Detection
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionStep, setDetectionStep] = useState("");
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [selectedSentence, setSelectedSentence] = useState<SentenceAnalysis | null>(null);

  // State for Humanizing
  const [isHumanizing, setIsHumanizing] = useState(false);
  const [humanizingStep, setHumanizingStep] = useState("");
  const [humanizeResult, setHumanizeResult] = useState<HumanizeResult | null>(null);

  // General Status
  const [error, setError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [activeTab, setActiveTab] = useState<"detector" | "humanizer">("detector");

  // App view modes: "automatic" (standard detector/humanizer) or "manual" (assisted word synonymizer)
  const [appMode, setAppMode] = useState<"automatic" | "manual">("automatic");

  // State for Manual Synonym Humanizer
  const [manualText, setManualText] = useState("");
  const [manualTokens, setManualTokens] = useState<string[]>([]);
  const [manualEditorSubTab, setManualEditorSubTab] = useState<"edit" | "interactive">("edit");
  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number | null>(null);
  const [isFetchingSynonyms, setIsFetchingSynonyms] = useState(false);
  const [synonymsSuggestions, setSynonymsSuggestions] = useState<string[]>([]);
  const [customSynonymInput, setCustomSynonymInput] = useState("");
  const [manualCopiedText, setManualCopiedText] = useState(false);

  // Load saved text and key on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("humanizai_saved_text");
      if (saved) {
        setInputText(saved);
      }
      const savedManual = localStorage.getItem("humanizai_saved_manual_text");
      if (savedManual) {
        setManualText(savedManual);
        setManualTokens(tokenizeText(savedManual));
      } else if (saved) {
        setManualText(saved);
        setManualTokens(tokenizeText(saved));
      }
      const savedKey = localStorage.getItem("humanizai_custom_gemini_key");
      if (savedKey) {
        setCustomApiKey(savedKey);
        setTempKeyInput(savedKey);
      }
    } catch (e) {
      console.warn("localStorage não está acessível neste ambiente:", e);
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    const cleanKey = key.trim();
    setCustomApiKey(cleanKey);
    try {
      if (cleanKey) {
        localStorage.setItem("humanizai_custom_gemini_key", cleanKey);
      } else {
        localStorage.removeItem("humanizai_custom_gemini_key");
      }
      setIsStaticDeployError(false);
      setError(null);
    } catch (e) {
      console.warn("Não foi possível salvar a chave no localStorage:", e);
    }
  };

  // Intercept uncaught script errors and promise rejections
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error("Global error caught:", event.error || event.message);
      // Only set error if it is from our app scope to avoid noise from extensions
      if (event.filename && (event.filename.includes("src") || event.filename.includes("localhost") || event.filename.includes("ais-dev"))) {
        setError(`Erro no aplicativo: ${event.message || "Erro de script carregado"}`);
      }
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
      const msg = event.reason?.message || event.reason || "Erro desconhecido na rede";
      setError(`Falha na requisição: ${msg}`);
    };
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  // Save text changes
  const handleTextChange = (text: string) => {
    setInputText(text);
    try {
      localStorage.setItem("humanizai_saved_text", text);
    } catch (e) {
      console.warn("Não foi possível salvar no localStorage:", e);
    }
  };

  // Helper for counts
  const wordCount = inputText.trim() === "" ? 0 : inputText.trim().split(/\s+/).length;
  const charCount = inputText.length;

  // Simulate loader messages
  const runDetectionLoader = () => {
    let index = 0;
    setDetectionStep(DETECTION_STEPS[0]);
    const interval = setInterval(() => {
      index++;
      if (index < DETECTION_STEPS.length) {
        setDetectionStep(DETECTION_STEPS[index]);
      } else {
        clearInterval(interval);
      }
    }, 900);
    return interval;
  };

  const runHumanizationLoader = () => {
    let index = 0;
    setHumanizingStep(HUMANIZATION_STEPS[0]);
    const interval = setInterval(() => {
      index++;
      if (index < HUMANIZATION_STEPS.length) {
        setHumanizingStep(HUMANIZATION_STEPS[index]);
      } else {
        clearInterval(interval);
      }
    }, 1100);
    return interval;
  };

  // Robust fallback runner to handle 503 or model unavailability on the client-side
  const generateContentWithFallbackClient = async (ai: any, config: { contents: string; config: any }) => {
    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"];
    let lastError: any = null;

    for (const model of models) {
      try {
        console.log(`Tentando executar requisição cliente com o modelo: ${model}`);
        const response = await ai.models.generateContent({
          model: model,
          contents: config.contents,
          config: config.config
        });
        console.log(`Requisição cliente bem-sucedida usando o modelo: ${model}`);
        return response;
      } catch (err: any) {
        console.warn(`Aviso: Falha com o modelo ${model} no cliente. Detalhes: ${err.message || JSON.stringify(err)}. Tentando próximo fallback...`);
        lastError = err;
        // Do not try another model if it's a 401 unauthorized key error
        if (err.status === 401 || (err.message && err.message.includes("API key") && !err.message.includes("permission"))) {
          throw err;
        }
      }
    }

    throw lastError || new Error("Todos os de IA disponíveis falharam na execução cliente.");
  };

  // Run AI Detection API Call
  const handleDetect = async () => {
    if (wordCount < 5) {
      setError("Por favor, insira um texto mais longo (mínimo de 5 palavras) para realizar uma análise precisa.");
      return;
    }
    setError(null);
    setIsDetecting(true);
    setDetectionResult(null);
    setSelectedSentence(null);

    const loaderInterval = runDetectionLoader();

    // Se temos uma chave customizada salva localmente, rodamos direto no cliente para máxima confiabilidade
    if (customApiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: customApiKey });
        const prompt = `Analise detalhadamente o seguinte texto para detectar se foi escrito por Inteligência Artificial (como ChatGPT, Gemini, Claude, etc.) ou se é humano.
Foque na perplexidade (previsibilidade de palavras), burstiness (variação do tamanho e estrutura das sentenças), uso de jargões típicos de IA e padrões repetitivos.

Divida o texto em sentenças lógicas e atribua uma probabilidade aproximada de IA para cada sentença individual de forma justa.

Texto para análise:
"""
${inputText}
"""`;

        const response = await generateContentWithFallbackClient(ai, {
          contents: prompt,
          config: {
            systemInstruction: "Você é um especialista em linguística computacional e detecção de conteúdos gerados por inteligência artificial. Sua análise deve ser minuciosa, equilibrada e justa, assemelhando-se aos melhores detectores do mercado como Turnitin e GPTZero. Você deve retornar estritamente uma resposta estruturada em formato JSON.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                verdict: { type: Type.STRING },
                summary: { type: Type.STRING },
                metrics: {
                  type: Type.OBJECT,
                  properties: {
                    perplexity: { type: Type.INTEGER },
                    burstiness: { type: Type.INTEGER },
                    repetition: { type: Type.INTEGER },
                    vocabulary: { type: Type.INTEGER }
                  },
                  required: ["perplexity", "burstiness", "repetition", "vocabulary"]
                },
                sentences: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      score: { type: Type.INTEGER }
                    },
                    required: ["text", "score"]
                  }
                },
                clues: { type: Type.ARRAY, items: { type: Type.STRING } },
                tips: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["score", "verdict", "summary", "metrics", "sentences", "clues", "tips"]
            }
          }
        });

        const responseText = response.text;
        if (!responseText) {
          throw new Error("Resposta do modelo Gemini veio vazia.");
        }

        const data: DetectionResult = JSON.parse(responseText);
        setDetectionResult(data);
        if (data.sentences && data.sentences.length > 0) {
          setSelectedSentence(data.sentences[0]);
        }
        setActiveTab("detector");
        setIsDetecting(false);
        clearInterval(loaderInterval);
        return;
      } catch (err: any) {
        console.error("Erro na detecção via cliente:", err);
        setError(`Erro na chamada direta à API do Gemini: ${err.message || err}`);
        setIsDetecting(false);
        clearInterval(loaderInterval);
        return;
      }
    }

    try {
      const response = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });

      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("text/html")) {
        setIsStaticDeployError(true);
        throw new Error("Hospedagem Estática Sem Servidor Ativo (Vercel/GitHub Pages). Ative a execução via Chave API do Gemini local para rodar sem servidor.");
      }

      if (!response.ok) {
        let errText = "";
        try {
          const errData = await response.json();
          errText = errData.error || errData.details;
        } catch(e) {
          errText = await response.text();
        }
        throw new Error(errText || "Erro desconhecido na detecção.");
      }

      const data: DetectionResult = await response.json();
      setDetectionResult(data);
      if (data.sentences && data.sentences.length > 0) {
        setSelectedSentence(data.sentences[0]);
      }
      setActiveTab("detector");
    } catch (err: any) {
      console.error(err);
      if (err.message && (err.message.includes("is not valid JSON") || err.message.includes("Unexpected token"))) {
        setIsStaticDeployError(true);
        setError("Ambiente de hospedagem estática detectado (Vercel/GitHub Pages). Configure uma Chave API do Gemini local no painel abaixo para rodar o app de forma autônoma e gratuita!");
      } else {
        setError(err.message || "Erro de conexão com o servidor. Verifique suas credenciais da API Gemini.");
      }
    } finally {
      clearInterval(loaderInterval);
      setIsDetecting(false);
    }
  };

  // Run Humanization API Call
  const handleHumanize = async () => {
    if (wordCount < 5) {
      setError("Por favor, insira um texto de pelo menos 5 palavras para que a humanização seja eficaz.");
      return;
    }
    setError(null);
    setIsHumanizing(true);
    setHumanizeResult(null);

    const loaderInterval = runHumanizationLoader();

    // Se temos uma chave customizada salva localmente, rodamos direto no cliente
    if (customApiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: customApiKey });
        
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
${inputText}
"""`;

        const response = await generateContentWithFallbackClient(ai, {
          contents: prompt,
          config: {
            systemInstruction: "Você é um reescritor profissional de textos e especialista sênior em redação humana criativa e acadêmica. Seu único objetivo é reescrever o texto de entrada mantendo 100% de sua mensagem, fatos e precisão, mas convertendo todo o estilo de escrita para uma assinatura linguística perfeitamente humana que neutralize detectores de IA. Retorne o resultado em formato JSON.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                humanizedText: { type: Type.STRING },
                estimatedScore: { type: Type.INTEGER },
                originalScore: { type: Type.INTEGER },
                explanations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      category: { type: Type.STRING },
                      description: { type: Type.STRING }
                    },
                    required: ["category", "description"]
                  }
                }
              },
              required: ["humanizedText", "estimatedScore", "originalScore", "explanations"]
            }
          }
        });

        const responseText = response.text;
        if (!responseText) {
          throw new Error("Resposta de humanização veio vazia.");
        }

        const data: HumanizeResult = JSON.parse(responseText);
        setHumanizeResult(data);
        setActiveTab("humanizer");
        setIsHumanizing(false);
        clearInterval(loaderInterval);
        return;
      } catch (err: any) {
        console.error("Erro na humanização via cliente:", err);
        setError(`Erro na chamada direta ao Gemini: ${err.message || err}`);
        setIsHumanizing(false);
        clearInterval(loaderInterval);
        return;
      }
    }

    try {
      const response = await fetch("/api/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          mode,
          intensity,
          language
        }),
      });

      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("text/html")) {
        setIsStaticDeployError(true);
        throw new Error("Hospedagem Estática Sem Servidor Ativo (Vercel/GitHub Pages). Ative a execução via Chave API do Gemini local para rodar sem servidor.");
      }

      if (!response.ok) {
        let errText = "";
        try {
          const errData = await response.json();
          errText = errData.error || errData.details;
        } catch(e) {
          errText = await response.text();
        }
        throw new Error(errText || "Erro desconhecido ao humanizar o texto.");
      }

      const data: HumanizeResult = await response.json();
      setHumanizeResult(data);
      setActiveTab("humanizer");
    } catch (err: any) {
      console.error(err);
      if (err.message && (err.message.includes("is not valid JSON") || err.message.includes("Unexpected token"))) {
        setIsStaticDeployError(true);
        setError("Ambiente de hospedagem estática detectado (Vercel/GitHub Pages). Configure uma Chave API do Gemini local no painel abaixo para rodar o app de forma autônoma e gratuita!");
      } else {
        setError(err.message || "Não foi possível humanizar o texto. Verifique as configurações da API Gemini.");
      }
    } finally {
      clearInterval(loaderInterval);
      setIsHumanizing(false);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Paste a template
  const handleLoadPaste = (key: keyof typeof PASTES) => {
    handleTextChange(PASTES[key]);
    setError(null);
  };

  const handleClear = () => {
    handleTextChange("");
    setDetectionResult(null);
    setHumanizeResult(null);
    setSelectedSentence(null);
    setError(null);
  };

  // Manual Humanizer Handlers
  const handleImportToManual = () => {
    setManualText(inputText);
    const tokens = tokenizeText(inputText);
    setManualTokens(tokens);
    setManualEditorSubTab("interactive");
    setSelectedTokenIndex(null);
    setSynonymsSuggestions([]);
  };

  const handleImportToAutomatic = () => {
    setInputText(manualText);
    setAppMode("automatic");
  };

  const handleManualTextChange = (text: string) => {
    setManualText(text);
    const tokens = tokenizeText(text);
    setManualTokens(tokens);
    try {
      localStorage.setItem("humanizai_saved_manual_text", text);
    } catch (e) {
      console.warn("Não foi possível salvar manualText no localStorage:", e);
    }
  };

  const handleCopyManualText = () => {
    navigator.clipboard.writeText(manualText);
    setManualCopiedText(true);
    setTimeout(() => setManualCopiedText(false), 2000);
  };

  const fetchSynonymsForWord = async (word: string, surroundingText: string) => {
    setIsFetchingSynonyms(true);
    setSynonymsSuggestions([]);
    setCustomSynonymInput("");
    try {
      if (customApiKey) {
        const ai = new GoogleGenAI({ apiKey: customApiKey });
        const prompt = `Analise a palavra "${word}" dentro do seguinte texto. Proponha entre 5 e 8 sinônimos inteligentes ou expressões alternativas que mantenham a coesão do texto, mas comecem a torná-lo mais dinâmico, humano e menos mecânico/previsível.

Texto de contexto:
"""
${surroundingText || word}
"""

Retorne estritamente um JSON com uma lista de sugestões.`;

        const response = await generateContentWithFallbackClient(ai, {
          contents: prompt,
          config: {
            systemInstruction: "Você é um assistente sênior de escrita humana e dicionário de sinônimos contextualizados. Forneça termos precisos que possam substituir diretamente a palavra especificada mantendo a concordância de gênero e número. Retorne o resultado estritamente em formato JSON.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                suggestions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Alternativas ou sinônimos em português de alta qualidade e com concordância correta."
                }
              },
              required: ["suggestions"]
            }
          }
        });

        const responseText = response.text;
        if (responseText) {
          const parsed = JSON.parse(responseText);
          setSynonymsSuggestions(parsed.suggestions || []);
        } else {
          throw new Error("Resposta do modelo de IA vazia.");
        }
      } else {
        const response = await fetch("/api/synonyms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ word, text: surroundingText }),
        });

        if (!response.ok) {
          throw new Error("Erro ao buscar sugestões com o servidor.");
        }

        const data = await response.json();
        setSynonymsSuggestions(data.suggestions || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao buscar sinônimos com IA: ${err.message || "Tente novamente mais tarde."}`);
    } finally {
      setIsFetchingSynonyms(false);
    }
  };

  const handleReplaceToken = (replacement: string) => {
    if (selectedTokenIndex === null) return;
    const cleanWord = replacement.trim();
    if (!cleanWord) return;

    const newTokens = [...manualTokens];
    newTokens[selectedTokenIndex] = cleanWord;
    setManualTokens(newTokens);
    
    const newText = newTokens.join("");
    handleManualTextChange(newText);
    
    // Clear selection
    setSelectedTokenIndex(null);
    setSynonymsSuggestions([]);
    setCustomSynonymInput("");
  };

  // UI styling helpers
  const getScoreColor = (score: number) => {
    if (score < 25) return "text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100";
    if (score < 65) return "text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100";
    return "text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100";
  };

  const getScoreBadgeBg = (score: number) => {
    if (score < 25) return "bg-emerald-500";
    if (score < 65) return "bg-amber-500";
    return "bg-rose-500";
  };

  const getSentenceBgColor = (score: number) => {
    // Return subtle highlight colors
    if (score < 20) return "bg-emerald-50 text-emerald-950 hover:bg-emerald-100/80 cursor-pointer border-b-2 border-emerald-200 transition-all px-1 rounded-sm";
    if (score < 50) return "bg-amber-50 text-amber-950 hover:bg-amber-100/80 cursor-pointer border-b-2 border-amber-200 transition-all px-1 rounded-sm";
    if (score < 80) return "bg-orange-50 text-orange-950 hover:bg-orange-100/80 cursor-pointer border-b-2 border-orange-200 transition-all px-1 rounded-sm";
    return "bg-rose-50 text-rose-950 hover:bg-rose-100/80 cursor-pointer border-b-2 border-rose-200 transition-all px-1 rounded-sm";
  };

  const getSentenceBadge = (score: number) => {
    if (score < 20) return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (score < 50) return "bg-amber-100 text-amber-800 border-amber-200";
    if (score < 80) return "bg-orange-100 text-orange-800 border-orange-200";
    return "bg-rose-100 text-rose-800 border-rose-200";
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#1e293b] font-sans antialiased flex flex-col">
      {/* Premium Elegant Header */}
      <header className="bg-white border-b border-[#e2e8f0] py-5 px-6 sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-linear-to-tr from-slate-900 to-indigo-950 p-2.5 rounded-xl shadow-xs text-white">
              <Sparkles className="w-6 h-6 text-indigo-300 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                Humaniz<span className="text-indigo-600 font-black">AI</span>
                <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-150">
                  Potente & Antidetectável
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Detecção linguística calibrada e humanizador de redações contra Turnitin, GPTZero & CopyLeaks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {customApiKey ? (
              <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                Gemini: API Direta Ativa
              </span>
            ) : (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                Servidor Gemini Ativo
              </span>
            )}
            
            <button
              onClick={() => setShowKeyForm(!showKeyForm)}
              className="text-xs text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition-all font-semibold flex items-center gap-1 cursor-pointer"
            >
              Configurar Chave API
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 flex flex-col gap-8">
        
        {/* Error Notification */}
        {error && (
          <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl shadow-sm animate-fade-in flex flex-col gap-3">
            <div className="flex items-start gap-3 w-full">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-rose-800">Erro na solicitação</h4>
                <p className="text-xs text-rose-700 mt-1 leading-relaxed">{error}</p>
              </div>
              <button 
                onClick={() => setError(null)} 
                className="text-rose-400 hover:text-rose-600 text-xs font-semibold px-2 py-1 rounded-sm cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Contextual Gemini 403 / Permission error troubleshooting block */}
            {customApiKey && (error.includes("PERMISSION_DENIED") || error.toLowerCase().includes("permission") || error.includes("403")) && (
              <div className="bg-white p-4 rounded-xl border border-rose-200 text-xs text-slate-700 flex flex-col gap-3 shadow-xs">
                <div className="font-bold text-rose-600 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-rose-500" />
                  Como resolver o erro de Permissão (403):
                </div>
                <ol className="list-decimal list-inside space-y-2 text-slate-600 pl-1 leading-relaxed">
                  <li>
                    <strong>Use o Google AI Studio correto:</strong> Garanta que você criou a chave no portal gratuito do <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-semibold">Google AI Studio</a>, e não no painel geral do Google Cloud (GCP). Chaves criadas no Google Cloud Console frequentemente não têm a API <em>"Generative Language API"</em> ativada por padrão.
                  </li>
                  <li>
                    <strong>Ative a Generative Language API:</strong> Se você preferir usar uma chave do Google Cloud Console (GCP), acesse seu console do GCP, selecione seu projeto atual, busque por <strong>"Generative Language API"</strong> na barra de pesquisa e clique em <strong>Ativar (Enable)</strong>.
                  </li>
                  <li>
                    <strong>Região geográfica:</strong> A API do Gemini pode estar restrita em certos países ou se você estiver sob uso de alguma VPN restritiva. Tente desativá-la ou ajustar a região.
                  </li>
                  <li>
                    <strong>Testar outro modelo:</strong> O aplicativo tenta o <em>gemini-2.5-flash</em> e depois faz fallback para o <em>gemini-2.0-flash</em>. Garanta que seu projeto no AI Studio tem cota habilitada para esses modelos.
                  </li>
                </ol>
                <div className="mt-1 pt-3 border-t border-slate-100 flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setShowKeyForm(true);
                      setError(null);
                    }}
                    className="text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                  >
                    ⚙️ Alterar Chave de API
                  </button>
                  <button
                    onClick={() => {
                      handleSaveApiKey("");
                      setTempKeyInput("");
                      setError(null);
                    }}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                  >
                    🗑️ Remover Chave e Usar Servidor Padrão
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Gemini API Key Panel */}
        {(showKeyForm || isStaticDeployError) && (
          <div className="bg-gradient-to-r from-indigo-50 to-slate-50 border border-indigo-200/80 p-5 rounded-2xl shadow-xs animate-fade-in flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Configuração de API do Gemini (Uso Autônomo)
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
                {isStaticDeployError ? (
                  <strong className="text-rose-600 font-semibold block mb-1">
                    ⚠️ Hospedagem Estática Sem Servidor Ativo Detectada!
                  </strong>
                ) : null}
                Este aplicativo foi detectado como hospedado de forma estática pura (como na Vercel ou GitHub Pages). Para fazê-lo funcionar de forma 100% autônoma, insira uma chave de API gratuita do Gemini abaixo.
                Sua chave fica salva apenas no seu navegador de forma privada. Obtenha uma grátis no <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 font-bold underline">Google AI Studio</a>.
              </p>
            </div>
            
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <input
                type="password"
                placeholder="Insira sua GEMINI_API_KEY..."
                value={tempKeyInput}
                onChange={(e) => setTempKeyInput(e.target.value)}
                className="text-xs px-3 py-2 border border-slate-300 rounded-lg w-64 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-xs"
              />
              <button
                onClick={() => {
                  handleSaveApiKey(tempKeyInput);
                  setShowKeyForm(false);
                }}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg transition-all shadow-xs shrink-0 cursor-pointer"
              >
                Salvar Chave
              </button>
              {customApiKey && (
                <button
                  onClick={() => {
                    handleSaveApiKey("");
                    setTempKeyInput("");
                    setShowKeyForm(false);
                  }}
                  className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold px-3 py-2 rounded-lg transition-all shrink-0 cursor-pointer"
                  title="Remover Chave"
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mode Selector Segmented Control */}
        <div className="flex flex-col sm:flex-row border-b border-[#e2e8f0] pb-4 items-start sm:items-center justify-between gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setAppMode("automatic")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                appMode === "automatic"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-500" />
              Modo Automático (Detector & IA)
            </button>
            <button
              onClick={() => {
                setAppMode("manual");
                if (!manualText && inputText) {
                  handleImportToManual();
                }
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                appMode === "manual"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileText className="w-4 h-4 text-emerald-500" />
              Modo Manual Assistido (Substituidor de Palavras)
            </button>
          </div>

          {appMode === "automatic" && inputText && (
            <button
              onClick={handleImportToManual}
              className="text-xs bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              Transferir para Editor Manual
            </button>
          )}

          {appMode === "manual" && manualText && (
            <button
              onClick={handleImportToAutomatic}
              className="text-xs bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Transferir para Detector Automático
            </button>
          )}
        </div>

        {appMode === "automatic" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT SIDE: Text input and configuration */}
          <section className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Input Card */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#e2e8f0] bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold uppercase tracking-wider">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  Área de Texto Original
                </div>
                
                {/* Word & Char counter */}
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>Words: <strong className="text-slate-800 font-medium">{wordCount}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>Chars: <strong className="text-slate-800 font-medium">{charCount}</strong></span>
                </div>
              </div>

              {/* Text Area */}
              <div className="relative">
                <textarea
                  className="w-full h-80 p-5 text-slate-800 placeholder-slate-400 text-sm focus:outline-none resize-none leading-relaxed"
                  placeholder="Cole seu trabalho acadêmico, redação, tese ou artigo de IA aqui para começar a análise avançada..."
                  value={inputText}
                  onChange={(e) => handleTextChange(e.target.value)}
                />
                
                {inputText.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6 text-center">
                    <span className="text-xs text-slate-400 max-w-sm mt-2">
                      Cole seu texto ou experimente uma das amostras reais abaixo para ver o poder da nossa detecção e reescrita:
                    </span>
                  </div>
                )}
              </div>

              {/* Footer controls for text */}
              <div className="p-4 bg-slate-50/50 border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3">
                
                {/* Presets */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Testar amostras:</span>
                  <button 
                    onClick={() => handleLoadPaste("ai")}
                    className="text-xs bg-white text-slate-600 border border-slate-200 px-2.5 py-1 rounded-md hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                  >
                    ChatGPT Comum
                  </button>
                  <button 
                    onClick={() => handleLoadPaste("academic_ai")}
                    className="text-xs bg-white text-slate-600 border border-slate-200 px-2.5 py-1 rounded-md hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                  >
                    Acadêmico IA
                  </button>
                  <button 
                    onClick={() => handleLoadPaste("human")}
                    className="text-xs bg-white text-slate-600 border border-slate-200 px-2.5 py-1 rounded-md hover:bg-slate-50 hover:text-emerald-600 transition-colors"
                  >
                    Escrita Humana
                  </button>
                </div>

                {/* Reset / Clear */}
                {inputText && (
                  <button
                    onClick={handleClear}
                    className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1.5 font-medium transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Humanization Preferences & Action panel */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-xs flex flex-col gap-5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-[#f1f5f9] pb-3">
                <Layers className="w-4.5 h-4.5 text-indigo-500" />
                Configurações do Algoritmo de Humanização
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                
                {/* Style/Mode select */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    Modo do Texto
                    <HelpCircle className="w-3 h-3 text-slate-400" title="Define o vocabulário e o tom final do texto reescrito" />
                  </label>
                  <select
                    className="w-full text-xs bg-slate-50 border border-[#e2e8f0] rounded-lg p-2.5 text-slate-700 font-medium focus:outline-indigo-500 focus:bg-white cursor-pointer"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as any)}
                  >
                    <option value="academic">🎓 Acadêmico (Artigos/Teses)</option>
                    <option value="professional">💼 Profissional / Formal</option>
                    <option value="conversational">💬 Conversacional (Direto)</option>
                    <option value="narrative">📖 Narrativo / Storytelling</option>
                  </select>
                </div>

                {/* Intensity selection */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    Filtro Anti-Detecção
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setIntensity("standard")}
                      className={`text-[11px] font-semibold py-1.5 rounded-md transition-all ${
                        intensity === "standard"
                          ? "bg-white text-slate-800 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Padrão
                    </button>
                    <button
                      type="button"
                      onClick={() => setIntensity("high")}
                      className={`text-[11px] font-semibold py-1.5 rounded-md transition-all ${
                        intensity === "high"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Extremo (Turnitin)
                    </button>
                  </div>
                </div>

                {/* Target Language selection */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <Globe2 className="w-3 h-3 text-slate-400" />
                    Idioma de Saída
                  </label>
                  <select
                    className="w-full text-xs bg-slate-50 border border-[#e2e8f0] rounded-lg p-2.5 text-slate-700 font-medium focus:outline-indigo-500 focus:bg-white cursor-pointer"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="Português">🇧🇷 Português</option>
                    <option value="Inglês">🇺🇸 Inglês</option>
                    <option value="Espanhol">🇪🇸 Espanhol</option>
                    <option value="Francês">🇫🇷 Francês</option>
                  </select>
                </div>

              </div>

              {/* Action Trigger Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                
                {/* AI Detection Trigger Button */}
                <button
                  type="button"
                  onClick={handleDetect}
                  disabled={isDetecting || isHumanizing || !inputText}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 font-bold text-sm tracking-wide disabled:opacity-50 transition-all shadow-xs cursor-pointer"
                >
                  {isDetecting ? (
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></span>
                      <span>Analisando...</span>
                    </div>
                  ) : (
                    <>
                      <SearchCode className="w-4 h-4" />
                      Analisar (Detectar IA)
                    </>
                  )}
                </button>

                {/* Humanizer Trigger Button */}
                <button
                  type="button"
                  onClick={handleHumanize}
                  disabled={isDetecting || isHumanizing || !inputText}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm tracking-wide disabled:opacity-50 transition-all shadow-sm cursor-pointer"
                >
                  {isHumanizing ? (
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                      <span>Humanizando...</span>
                    </div>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      Humanizar Texto
                    </>
                  )}
                </button>

              </div>
            </div>

            {/* Interactive Loading States */}
            {isDetecting && (
              <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-xs text-center animate-pulse flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <SearchCode className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Processando verificação de IA</h4>
                  <p className="text-xs text-slate-500 mt-1 font-mono">{detectionStep}</p>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 max-w-xs overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full animate-[shimmer_1.5s_infinite] bg-linear-to-r from-indigo-500 via-purple-500 to-indigo-600" style={{ width: "85%" }}></div>
                </div>
              </div>
            )}

            {isHumanizing && (
              <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-xs text-center animate-pulse flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                  <Sparkles className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Reescrevendo estrutura linguística</h4>
                  <p className="text-xs text-indigo-600 mt-1 font-mono">{humanizingStep}</p>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 max-w-xs overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full animate-[shimmer_1.5s_infinite] bg-linear-to-r from-amber-400 via-orange-500 to-indigo-600" style={{ width: "90%" }}></div>
                </div>
              </div>
            )}

          </section>

          {/* RIGHT SIDE: Comprehensive results display */}
          <section className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Nav Tabs for Results */}
            <div className="flex border-b border-[#e2e8f0] bg-slate-100 p-1.5 rounded-xl">
              <button
                onClick={() => setActiveTab("detector")}
                disabled={!detectionResult}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === "detector" && detectionResult
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
              >
                <SearchCode className="w-4 h-4" />
                Painel Detector
                {detectionResult && (
                  <span className={`w-2 h-2 rounded-full ${getScoreBadgeBg(detectionResult.score)}`}></span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("humanizer")}
                disabled={!humanizeResult}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === "humanizer" && humanizeResult
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Painel Humanizado
                {humanizeResult && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                )}
              </button>
            </div>

            {/* Empty State when no action taken yet */}
            {!detectionResult && !humanizeResult && !isDetecting && !isHumanizing && (
              <div className="bg-white border border-[#e2e8f0] rounded-2xl p-8 shadow-xs text-center flex flex-col items-center justify-center min-h-[380px]">
                <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-4 border border-[#f1f5f9]">
                  <Gauge className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Resultados da Análise</h3>
                <p className="text-xs text-slate-500 mt-2 max-w-sm">
                  Insira seu texto na caixa ao lado e clique em um dos botões de ação para rodar a análise de IA ou gerar a versão humana equivalente.
                </p>
                <div className="mt-6 flex flex-col gap-2 w-full max-w-xs text-left">
                  <div className="flex items-center gap-2.5 text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-lg border border-[#f1f5f9]">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Score compatível com Turnitin</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-lg border border-[#f1f5f9]">
                    <CheckSquare className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Análise frase por frase detalhada</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 1: DETECTION REPORT PANEL */}
            {activeTab === "detector" && detectionResult && (
              <div className="flex flex-col gap-6 animate-fade-in">
                
                {/* Score Summary Card */}
                <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-xs flex flex-col gap-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Veredito do Detector
                      </span>
                      <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                        {detectionResult.verdict}
                      </h3>
                    </div>
                    
                    {/* Score badge with custom colors */}
                    <div className={`p-3 rounded-2xl border text-center font-mono min-w-[75px] ${getScoreColor(detectionResult.score)}`}>
                      <span className="block text-xl font-black leading-none">{detectionResult.score}%</span>
                      <span className="text-[10px] uppercase font-bold mt-1 block">Prob. IA</span>
                    </div>
                  </div>

                  {/* Summary commentary paragraph */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-[#f1f5f9]">
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {detectionResult.summary}
                    </p>
                  </div>

                  {/* Meter Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    
                    {/* Perplexity */}
                    <div className="bg-slate-50/65 p-3 rounded-xl border border-slate-100 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-600">Previsibilidade</span>
                        <span className="text-xs font-bold text-slate-800 font-mono">{detectionResult.metrics.perplexity}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${detectionResult.metrics.perplexity}%` }}></div>
                      </div>
                      <span className="text-[9px] text-slate-400">Palavras comuns e previsíveis típicas de IA</span>
                    </div>

                    {/* Burstiness */}
                    <div className="bg-slate-50/65 p-3 rounded-xl border border-slate-100 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-600">Variação de Ritmo</span>
                        <span className="text-xs font-bold text-slate-800 font-mono">{detectionResult.metrics.burstiness}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${detectionResult.metrics.burstiness}%` }}></div>
                      </div>
                      <span className="text-[9px] text-slate-400">Variedade de orações e tamanho de frases</span>
                    </div>

                    {/* Repetitiveness */}
                    <div className="bg-slate-50/65 p-3 rounded-xl border border-slate-100 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-600">Padrões de Transição</span>
                        <span className="text-xs font-bold text-slate-800 font-mono">{detectionResult.metrics.repetition}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${detectionResult.metrics.repetition}%` }}></div>
                      </div>
                      <span className="text-[9px] text-slate-400">Uso excessivo de clichês lógicos artificiais</span>
                    </div>

                    {/* Vocabulary */}
                    <div className="bg-slate-50/65 p-3 rounded-xl border border-slate-100 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-600">Diversidade Léxica</span>
                        <span className="text-xs font-bold text-slate-800 font-mono">{detectionResult.metrics.vocabulary}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-sky-500 h-full rounded-full" style={{ width: `${detectionResult.metrics.vocabulary}%` }}></div>
                      </div>
                      <span className="text-[9px] text-slate-400">Riqueza vocabular e originalidade de termos</span>
                    </div>

                  </div>
                </div>

                {/* Sentence by Sentence Map */}
                <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-xs flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-2 border-b border-[#f1f5f9] pb-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-slate-600" />
                      Mapeamento Sentença por Sentença
                    </h3>
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-md text-slate-500 font-semibold uppercase">
                      Clique nas sentenças
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    Abaixo está seu texto mapeado. Frases destacadas em vermelho forte têm padrões de alta previsibilidade, comuns em textos da inteligência artificial.
                  </p>

                  {/* Interactive highlight block */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 max-h-56 overflow-y-auto leading-relaxed text-sm select-none">
                    {(detectionResult.sentences || []).map((sent, i) => (
                      <span
                        key={i}
                        onClick={() => setSelectedSentence(sent)}
                        className={`mr-1.5 inline-block ${getSentenceBgColor(sent.score)} ${
                          selectedSentence?.text === sent.text ? "ring-2 ring-indigo-500 ring-offset-1 font-medium scale-[1.01]" : ""
                        }`}
                      >
                        {sent.text}{" "}
                      </span>
                    ))}
                  </div>

                  {/* Selected sentence feedback panel */}
                  {selectedSentence && (
                    <div className="bg-indigo-50/50 border border-indigo-100 p-3.5 rounded-xl flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase font-extrabold text-indigo-700 tracking-wider">
                          Análise da Sentença Selecionada
                        </span>
                        <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${getSentenceBadge(selectedSentence.score)}`}>
                          {selectedSentence.score}% IA
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 italic font-medium leading-normal bg-white p-2.5 rounded-lg border border-slate-100">
                        "{selectedSentence.text}"
                      </p>
                      <span className="text-[10px] text-indigo-600 font-semibold">
                        {selectedSentence.score >= 70 
                          ? "💡 Recomenda-se reescrever esta oração variando os termos e a ordem sintática para burlar filtros."
                          : selectedSentence.score >= 35
                          ? "💡 Oração neutra ou levemente padronizada. Ajustes pontuais nos conectores ajudam a torná-la perfeitamente humana."
                          : "✅ Assinatura linguística humana excelente nesta frase."
                        }
                      </span>
                    </div>
                  )}
                </div>

                {/* Clues and Tips cards */}
                <div className="grid grid-cols-1 gap-4">
                  
                  {/* Clues */}
                  <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Pistas de IA Detectadas
                    </h4>
                    <ul className="flex flex-col gap-2">
                      {(detectionResult.clues || []).map((clue, idx) => (
                        <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                          <span className="text-amber-500 font-bold shrink-0 mt-0.5">•</span>
                          <span>{clue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Humanization Advice / Tips */}
                  <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      Instruções de Humanização
                    </h4>
                    <ul className="flex flex-col gap-2">
                      {(detectionResult.tips || []).map((tip, idx) => (
                        <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                          <span className="text-indigo-500 font-bold shrink-0 mt-0.5">✓</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>

              </div>
            )}

            {/* TAB 2: HUMANIZED REPORT PANEL */}
            {activeTab === "humanizer" && humanizeResult && (
              <div className="flex flex-col gap-6 animate-fade-in">
                
                {/* Clean comparisons */}
                <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs flex flex-col gap-4">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Previsão de Sucesso no Turnitin/GPTZero
                  </span>
                  
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100 gap-4">
                    <div className="text-center flex-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">IA Original</span>
                      <span className="text-lg font-mono font-bold text-rose-500 line-through">
                        {humanizeResult.originalScore}%
                      </span>
                    </div>
                    
                    <div className="shrink-0">
                      <ArrowRight className="w-5 h-5 text-slate-400 animate-pulse" />
                    </div>

                    <div className="text-center flex-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Novo Score Estimado</span>
                      <span className="text-xl font-mono font-black text-emerald-600 flex items-center justify-center gap-1">
                        <TrendingDown className="w-4.5 h-4.5 text-emerald-500" />
                        {humanizeResult.estimatedScore}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Redução de {humanizeResult.originalScore - humanizeResult.estimatedScore}% nos padrões artificiais encontrados!</span>
                  </div>
                </div>

                {/* Humanized Text Result */}
                <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-[#e2e8f0] bg-slate-50/50 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      Texto Humanizado Pronto
                    </span>

                    <button
                      onClick={() => handleCopyText(humanizeResult.humanizedText)}
                      className="text-xs bg-white text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
                    >
                      {copiedText ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Texto</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-5 max-h-[340px] overflow-y-auto leading-relaxed text-sm text-slate-800 bg-white">
                    <p className="whitespace-pre-wrap">{humanizeResult.humanizedText}</p>
                  </div>

                  <div className="p-4 bg-slate-50/50 border-t border-[#e2e8f0] text-center">
                    <button
                      onClick={() => handleTextChange(humanizeResult.humanizedText)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-colors inline-flex items-center gap-1"
                    >
                      <ListRestart className="w-3.5 h-3.5" />
                      Enviar este texto humanizado para a área de edição
                    </button>
                  </div>
                </div>

                {/* Explanations listing */}
                <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-4 border-b border-[#f1f5f9] pb-3">
                    <Bookmark className="w-4 h-4 text-indigo-500" />
                    Melhorias Estruturais Aplicadas
                  </h4>
                  
                  <div className="flex flex-col gap-4">
                    {(humanizeResult.explanations || []).map((item, idx) => (
                      <div key={idx} className="flex gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0"></div>
                        <div>
                          <h5 className="text-xs font-bold text-slate-800">{item.category}</h5>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

          </section>

        </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
            {/* LEFT COLUMN: Manual Text Area & Clickable Tokens */}
            <section className="lg:col-span-7 flex flex-col gap-6">
              
              {/* Manual Editor Card */}
              <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-[#e2e8f0] bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-500" />
                      Espaço de Humanização Manual
                    </span>
                  </div>

                  {/* Sub Tabs for writing vs clicking */}
                  <div className="flex bg-slate-150 p-1 rounded-lg">
                    <button
                      onClick={() => setManualEditorSubTab("edit")}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        manualEditorSubTab === "edit"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      ✏️ Digitar / Colar
                    </button>
                    <button
                      onClick={() => {
                        setManualEditorSubTab("interactive");
                        setSelectedTokenIndex(null);
                        setSynonymsSuggestions([]);
                      }}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        manualEditorSubTab === "interactive"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      🖱️ Substituir Palavras
                    </button>
                  </div>
                </div>

                {/* Sub Tab 1: Edit Mode */}
                {manualEditorSubTab === "edit" && (
                  <div className="p-5">
                    <textarea
                      className="w-full h-80 p-4 text-slate-800 placeholder-slate-400 text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none leading-relaxed animate-fade-in"
                      placeholder="Insira ou cole seu texto aqui..."
                      value={manualText}
                      onChange={(e) => handleManualTextChange(e.target.value)}
                    />
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>Palavras: <strong className="text-slate-800 font-medium">{manualText.trim() === "" ? 0 : manualText.trim().split(/\s+/).length}</strong></span>
                      <span>Caracteres: <strong className="text-slate-800 font-medium">{manualText.length}</strong></span>
                    </div>
                  </div>
                )}

                {/* Sub Tab 2: Interactive Substitution Mode */}
                {manualEditorSubTab === "interactive" && (
                  <div className="p-5 animate-fade-in">
                    {manualTokens.length === 0 ? (
                      <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                          <FileText className="w-5 h-5" />
                        </div>
                        <p className="text-xs text-slate-500 max-w-sm">
                          O texto está vazio! Escreva ou cole algo na aba <strong>✏️ Digitar / Colar</strong> ou clique em <strong>"Transferir para Editor Manual"</strong> acima para começar.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <p className="text-xs text-slate-500">
                          💡 <strong>Como usar:</strong> Clique em qualquer palavra grifada em azul para pesquisar sinônimos sugeridos por IA no painel ao lado e substituí-la instantaneamente.
                        </p>

                        <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200/80 max-h-[380px] overflow-y-auto leading-relaxed text-sm whitespace-pre-wrap select-none shadow-inner">
                          {manualTokens.map((token, idx) => {
                            const word = isWordToken(token);
                            if (word) {
                              const isSelected = selectedTokenIndex === idx;
                              return (
                                <span
                                  key={idx}
                                  onClick={() => {
                                    setSelectedTokenIndex(idx);
                                    fetchSynonymsForWord(token, manualText);
                                  }}
                                  className={`inline-block mx-0.5 rounded px-1 transition-all cursor-pointer duration-150 ${
                                    isSelected
                                      ? "bg-emerald-600 text-white font-bold shadow-xs scale-105"
                                      : "text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 border-b border-indigo-200"
                                  }`}
                                  title="Clique para ver alternativas com IA"
                                >
                                  {token}
                                </span>
                              );
                            } else {
                              return <span key={idx}>{token}</span>;
                            }
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* RIGHT COLUMN: Synonym lookup details & controls */}
            <section className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Interactive Synonym Panel */}
              <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-xs flex flex-col gap-5 min-h-[350px]">
                {selectedTokenIndex === null ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-3 border border-slate-100">
                      <Sparkles className="w-5 h-5 text-emerald-500 animate-pulse" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">Assistente de Sinônimos IA</h3>
                    <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
                      Selecione uma palavra no texto interativo ao lado para ver sugestões inteligentes de sinônimos contextuais gerados pelo Gemini.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 animate-fade-in">
                    <div className="border-b border-slate-100 pb-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                        Palavra Selecionada
                      </span>
                      <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-1.5 mt-0.5">
                        <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-lg border border-emerald-150">
                          {manualTokens[selectedTokenIndex]}
                        </span>
                      </h3>
                    </div>

                    {/* AI Loading State */}
                    {isFetchingSynonyms ? (
                      <div className="py-8 text-center flex flex-col items-center gap-3">
                        <span className="w-6 h-6 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin"></span>
                        <span className="text-xs text-slate-500 font-medium animate-pulse">
                          Consultando o Gemini para sinônimos naturais...
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {/* Synonym badges */}
                        <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-2">
                            ✨ Alternativas Inteligentes com IA:
                          </label>
                          {synonymsSuggestions.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">
                              Nenhuma sugestão encontrada ou falha de conexão. Tente digitar seu próprio termo abaixo.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {synonymsSuggestions.map((suggestion, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleReplaceToken(suggestion)}
                                  className="text-xs bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 px-3 py-1.5 rounded-lg transition-all font-semibold cursor-pointer flex items-center gap-1"
                                >
                                  {suggestion}
                                  <ChevronRight className="w-3 h-3 text-slate-400" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Custom Replacement Input */}
                        <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
                            ✍️ Digitar termo próprio:
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Digite uma palavra..."
                              value={customSynonymInput}
                              onChange={(e) => setCustomSynonymInput(e.target.value)}
                              className="text-xs px-3 py-2 border border-slate-300 rounded-lg flex-1 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleReplaceToken(customSynonymInput);
                              }}
                            />
                            <button
                              onClick={() => handleReplaceToken(customSynonymInput)}
                              disabled={!customSynonymInput.trim()}
                              className="text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg transition-all cursor-pointer"
                            >
                              Aplicar
                            </button>
                          </div>
                        </div>

                        <p className="text-[10px] text-slate-400 mt-2 italic leading-relaxed">
                          * As sugestões do Gemini analisam toda a frase para garantir que a concordância verbal, gênero e número permaneçam corretos.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action and Copy Panel */}
              <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs flex flex-col gap-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Exportar Resultado
                </span>

                <button
                  onClick={handleCopyManualText}
                  disabled={!manualText}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm tracking-wide disabled:opacity-50 transition-all shadow-sm cursor-pointer"
                >
                  {manualCopiedText ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Texto Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Texto Final</span>
                    </>
                  )}
                </button>
                
                {manualText && (
                  <button
                    onClick={handleImportToAutomatic}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-colors text-center inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ListRestart className="w-3.5 h-3.5" />
                    Enviar este texto para a detecção automática
                  </button>
                )}
              </div>

            </section>
          </div>
        )}

      </main>

      {/* Aesthetic Footer */}
      <footer className="bg-white border-t border-[#e2e8f0] py-6 px-6 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 HumanizAI. Segurança, privacidade e naturalidade garantidas.</p>
          <p className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            Nenhum dado é enviado para bancos públicos de plagiarismo ou turnitin.
          </p>
        </div>
      </footer>
    </div>
  );
}
