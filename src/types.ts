export interface DetectionMetrics {
  perplexity: number;
  burstiness: number;
  repetition: number;
  vocabulary: number;
}

export interface SentenceAnalysis {
  text: string;
  score: number;
}

export interface DetectionResult {
  score: number;
  verdict: string;
  summary: string;
  metrics: DetectionMetrics;
  sentences: SentenceAnalysis[];
  clues: string[];
  tips: string[];
}

export interface HumanizeExplanation {
  category: string;
  description: string;
}

export interface HumanizeResult {
  humanizedText: string;
  estimatedScore: number;
  originalScore: number;
  explanations: HumanizeExplanation[];
}
