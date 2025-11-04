/**
 * Serviço de Voice AI (Transcrição e Análise de Chamadas)
 * Utiliza OpenAI Whisper para transcrição e GPT para análise de sentimento
 */

import { logger } from '../lib/logger';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// Inicializar cliente OpenAI se a chave estiver configurada
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface VoiceAnalysisResult {
  transcription: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
  keyPoints?: string[];
  actionItems?: string[];
  duration?: number;
  language?: string;
  status: 'completed' | 'failed' | 'partial';
  error?: string;
}

/**
 * Processa um arquivo de áudio: transcreve e analisa.
 * @param audioFilePath Caminho para o arquivo de áudio (mp3, wav, m4a, webm)
 * @param language Idioma do áudio (opcional, padrão: pt)
 * @returns Transcrição e análise de sentimento
 */
export async function processCallAudio(
  audioFilePath: string,
  language: string = 'pt'
): Promise<VoiceAnalysisResult> {
  logger.info({ audioFilePath, language }, 'Initiating Voice AI processing for audio file');

  if (!openai) {
    logger.error('OpenAI not configured. Voice AI service requires OPENAI_API_KEY.');
    return {
      transcription: '',
      sentiment: 'neutral',
      summary: 'OpenAI not configured',
      status: 'failed',
      error: 'OPENAI_API_KEY not set',
    };
  }

  try {
    // 1. Verificar se o arquivo existe
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    const fileStats = fs.statSync(audioFilePath);
    const fileSizeMB = fileStats.size / (1024 * 1024);

    logger.info({ audioFilePath, fileSizeMB: fileSizeMB.toFixed(2) }, 'Audio file found');

    // 2. Transcrever com Whisper
    logger.info('Starting transcription with Whisper');

    const audioFile = fs.createReadStream(audioFilePath);

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language,
      response_format: 'verbose_json',
    });

    logger.info(
      { transcriptionLength: transcription.text.length, duration: transcription.duration },
      'Transcription completed'
    );

    // 3. Analisar sentimento e gerar resumo com GPT
    logger.info('Starting sentiment analysis and summary generation');

    const analysisPrompt = `
Analise a seguinte transcrição de uma chamada telefônica e forneça:

1. Sentimento geral (positive, neutral, negative)
2. Resumo conciso (2-3 frases)
3. Pontos-chave mencionados
4. Itens de ação identificados

Transcrição:
${transcription.text}

Retorne no formato JSON:
{
  "sentiment": "positive|neutral|negative",
  "summary": "resumo da chamada",
  "keyPoints": ["ponto 1", "ponto 2", ...],
  "actionItems": ["ação 1", "ação 2", ...]
}
`;

    const analysis = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Você é um assistente especializado em análise de chamadas telefônicas para CRM imobiliário.',
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const aiResponse = analysis.choices[0].message.content || '{}';
    const parsedAnalysis = parseAnalysisResponse(aiResponse);

    logger.info({ sentiment: parsedAnalysis.sentiment }, 'Analysis completed');

    return {
      transcription: transcription.text,
      sentiment: parsedAnalysis.sentiment || 'neutral',
      summary: parsedAnalysis.summary || 'Resumo não disponível',
      keyPoints: parsedAnalysis.keyPoints || [],
      actionItems: parsedAnalysis.actionItems || [],
      duration: transcription.duration,
      language: transcription.language || language,
      status: 'completed',
    };
  } catch (error) {
    logger.error({ error, audioFilePath }, 'Failed to process audio file');

    return {
      transcription: '',
      sentiment: 'neutral',
      summary: 'Erro ao processar áudio',
      status: 'failed',
      error: (error as Error).message,
    };
  }
}

/**
 * Transcreve um arquivo de áudio sem análise (apenas transcrição).
 * @param audioFilePath Caminho para o arquivo de áudio
 * @param language Idioma do áudio (opcional)
 * @returns Transcrição do áudio
 */
export async function transcribeAudio(audioFilePath: string, language: string = 'pt'): Promise<string> {
  logger.info({ audioFilePath, language }, 'Transcribing audio file');

  if (!openai) {
    logger.error('OpenAI not configured.');
    throw new Error('OpenAI not configured. Voice AI service requires OPENAI_API_KEY.');
  }

  try {
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    const audioFile = fs.createReadStream(audioFilePath);

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language,
    });

    logger.info({ transcriptionLength: transcription.text.length }, 'Transcription completed');

    return transcription.text;
  } catch (error) {
    logger.error({ error, audioFilePath }, 'Failed to transcribe audio');
    throw error;
  }
}

/**
 * Analisa o sentimento de um texto (transcrição).
 * @param text Texto a ser analisado
 * @returns Sentimento e resumo
 */
export async function analyzeSentiment(text: string): Promise<{
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
  confidence?: number;
}> {
  logger.info({ textLength: text.length }, 'Analyzing sentiment');

  if (!openai) {
    logger.error('OpenAI not configured.');
    throw new Error('OpenAI not configured.');
  }

  try {
    const prompt = `
Analise o sentimento do seguinte texto e forneça:
1. Sentimento geral (positive, neutral, negative)
2. Resumo conciso

Texto:
${text}

Retorne no formato JSON:
{
  "sentiment": "positive|neutral|negative",
  "summary": "resumo do texto",
  "confidence": 0.85
}
`;

    const analysis = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente especializado em análise de sentimento.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const aiResponse = analysis.choices[0].message.content || '{}';
    const parsed = parseAnalysisResponse(aiResponse);

    logger.info({ sentiment: parsed.sentiment }, 'Sentiment analysis completed');

    return {
      sentiment: parsed.sentiment || 'neutral',
      summary: parsed.summary || 'Resumo não disponível',
      confidence: parsed.confidence,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to analyze sentiment');
    throw error;
  }
}

/**
 * Processa um arquivo de áudio em lote (útil para múltiplas chamadas).
 * @param audioFilePaths Lista de caminhos de arquivos de áudio
 * @param language Idioma dos áudios
 * @returns Lista de resultados
 */
export async function processBulkAudio(
  audioFilePaths: string[],
  language: string = 'pt'
): Promise<VoiceAnalysisResult[]> {
  logger.info({ count: audioFilePaths.length, language }, 'Processing bulk audio files');

  const results = await Promise.all(
    audioFilePaths.map(async (filePath) => {
      try {
        return await processCallAudio(filePath, language);
      } catch (error) {
        logger.error({ error, filePath }, 'Failed to process audio file in bulk');
        return {
          transcription: '',
          sentiment: 'neutral' as const,
          summary: 'Erro ao processar',
          status: 'failed' as const,
          error: (error as Error).message,
        };
      }
    })
  );

  const successCount = results.filter((r) => r.status === 'completed').length;

  logger.info({ total: audioFilePaths.length, success: successCount }, 'Bulk audio processing completed');

  return results;
}

/**
 * Parse da resposta de análise da IA
 */
function parseAnalysisResponse(response: string): any {
  try {
    // Tentar extrair JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback: parse manual
    const result: any = {};

    const sentimentMatch = response.match(/sentiment['":\s]*(positive|neutral|negative)/i);
    if (sentimentMatch) {
      result.sentiment = sentimentMatch[1].toLowerCase();
    }

    const summaryMatch = response.match(/summary['":\s]*["']([^"']+)["']/i);
    if (summaryMatch) {
      result.summary = summaryMatch[1];
    }

    return result;
  } catch (error) {
    logger.error({ error, response }, 'Failed to parse analysis response');
    return {};
  }
}

/**
 * Verifica se o serviço de Voice AI está configurado.
 * @returns true se configurado, false caso contrário
 */
export function isVoiceAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Valida se um arquivo de áudio é suportado.
 * @param filePath Caminho do arquivo
 * @returns true se suportado
 */
export function isSupportedAudioFormat(filePath: string): boolean {
  const supportedFormats = ['.mp3', '.wav', '.m4a', '.webm', '.mp4', '.mpeg', '.mpga'];
  const ext = path.extname(filePath).toLowerCase();
  return supportedFormats.includes(ext);
}
