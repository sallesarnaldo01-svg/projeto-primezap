import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  processCallAudio,
  transcribeAudio,
  analyzeSentiment,
  processCallsBatch,
} from '../../src/services/voice-ai.service';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

// Mock do OpenAI
vi.mock('openai');

describe('Voice AI Service', () => {
  const fixturesDir = path.join(__dirname, '../fixtures');
  const testAudioPath = path.join(fixturesDir, 'test-audio.mp3');

  beforeAll(() => {
    // Criar diretório de fixtures se não existir
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    // Criar arquivo de áudio de teste (mock)
    if (!fs.existsSync(testAudioPath)) {
      // Criar um arquivo binário simples como mock
      const buffer = Buffer.from('mock audio data - ID3 tag simulation');
      fs.writeFileSync(testAudioPath, buffer);
    }
  });

  afterAll(() => {
    // Limpar arquivo de teste
    if (fs.existsSync(testAudioPath)) {
      fs.unlinkSync(testAudioPath);
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processCallAudio', () => {
    it('deve transcrever e analisar áudio completo com sucesso', async () => {
      const mockTranscription = {
        text: 'Olá, gostaria de informações sobre o imóvel disponível na Rua das Flores.',
        duration: 15,
        language: 'pt',
      };

      const mockAnalysis = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                sentiment: 'positive',
                summary: 'Cliente demonstrou interesse em imóvel específico',
                keyPoints: ['Interesse em imóvel', 'Localização: Rua das Flores', 'Tom educado'],
                actionItems: ['Enviar informações do imóvel', 'Agendar visita'],
                confidence: 0.92,
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.audio.transcriptions.create).mockResolvedValue(mockTranscription);
      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockAnalysis);

      const result = await processCallAudio(testAudioPath, 'pt');

      expect(result.status).toBe('completed');
      expect(result.transcription).toBe(mockTranscription.text);
      expect(result.sentiment).toBe('positive');
      expect(result.summary).toContain('Cliente');
      expect(result.keyPoints).toHaveLength(3);
      expect(result.actionItems).toHaveLength(2);
      expect(result.duration).toBe(15);
      expect(result.confidence).toBe(0.92);
    });

    it('deve processar áudio com sentimento negativo', async () => {
      const mockTranscription = {
        text: 'Estou muito insatisfeito com o atendimento. Já liguei várias vezes e ninguém resolve.',
      };

      const mockAnalysis = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                sentiment: 'negative',
                summary: 'Cliente insatisfeito com qualidade do atendimento',
                keyPoints: ['Reclamação sobre atendimento', 'Múltiplas tentativas de contato', 'Frustração evidente'],
                actionItems: ['Escalar para gerente', 'Ligar urgentemente', 'Oferecer compensação'],
                confidence: 0.95,
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.audio.transcriptions.create).mockResolvedValue(mockTranscription);
      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockAnalysis);

      const result = await processCallAudio(testAudioPath, 'pt');

      expect(result.status).toBe('completed');
      expect(result.sentiment).toBe('negative');
      expect(result.summary).toContain('insatisfeito');
      expect(result.actionItems).toContain('Escalar para gerente');
    });

    it('deve processar áudio com sentimento neutro', async () => {
      const mockTranscription = {
        text: 'Gostaria de saber o horário de funcionamento e endereço.',
      };

      const mockAnalysis = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                sentiment: 'neutral',
                summary: 'Cliente solicitando informações básicas',
                keyPoints: ['Pergunta sobre horário', 'Pergunta sobre endereço'],
                actionItems: ['Fornecer informações solicitadas'],
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.audio.transcriptions.create).mockResolvedValue(mockTranscription);
      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockAnalysis);

      const result = await processCallAudio(testAudioPath, 'pt');

      expect(result.status).toBe('completed');
      expect(result.sentiment).toBe('neutral');
    });

    it('deve retornar erro quando arquivo não existe', async () => {
      const result = await processCallAudio('/path/invalid/audio.mp3', 'pt');

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not found');
    });

    it('deve retornar erro quando OpenAI não configurado', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const result = await processCallAudio(testAudioPath, 'pt');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('OPENAI_API_KEY');

      process.env.OPENAI_API_KEY = originalKey;
    });

    it('deve lidar com erro de transcrição', async () => {
      // @ts-ignore
      vi.mocked(OpenAI.prototype.audio.transcriptions.create).mockRejectedValue(
        new Error('Transcription failed')
      );

      const result = await processCallAudio(testAudioPath, 'pt');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Transcription failed');
    });

    it('deve lidar com erro de análise', async () => {
      const mockTranscription = {
        text: 'Texto transcrito',
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.audio.transcriptions.create).mockResolvedValue(mockTranscription);
      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockRejectedValue(
        new Error('Analysis failed')
      );

      const result = await processCallAudio(testAudioPath, 'pt');

      // Deve retornar transcrição mesmo se análise falhar
      expect(result.status).toBe('completed');
      expect(result.transcription).toBe('Texto transcrito');
      // Análise deve ter fallback
      expect(result.sentiment).toBeDefined();
    });

    it('deve aceitar diferentes idiomas', async () => {
      const mockTranscription = {
        text: 'Hello, I would like information about the property.',
        language: 'en',
      };

      const mockAnalysis = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                sentiment: 'positive',
                summary: 'Customer interested in property',
                keyPoints: ['Property inquiry'],
                actionItems: ['Send information'],
              }),
            },
          },
        ],
      };

      // @ts-ignore
      const mockCreate = vi.mocked(OpenAI.prototype.audio.transcriptions.create).mockResolvedValue(mockTranscription);
      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockAnalysis);

      await processCallAudio(testAudioPath, 'en');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'en',
        })
      );
    });
  });

  describe('transcribeAudio', () => {
    it('deve transcrever áudio sem análise', async () => {
      const mockTranscription = {
        text: 'Transcrição de teste sem análise de sentimento',
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.audio.transcriptions.create).mockResolvedValue(mockTranscription);

      const result = await transcribeAudio(testAudioPath, 'pt');

      expect(result).toBe('Transcrição de teste sem análise de sentimento');
    });

    it('deve lançar erro quando arquivo não existe', async () => {
      await expect(transcribeAudio('/invalid/path.mp3')).rejects.toThrow('not found');
    });

    it('deve lançar erro quando OpenAI não configurado', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      await expect(transcribeAudio(testAudioPath)).rejects.toThrow('OPENAI_API_KEY');

      process.env.OPENAI_API_KEY = originalKey;
    });

    it('deve usar idioma padrão quando não especificado', async () => {
      const mockTranscription = {
        text: 'Texto transcrito',
      };

      // @ts-ignore
      const mockCreate = vi.mocked(OpenAI.prototype.audio.transcriptions.create).mockResolvedValue(mockTranscription);

      await transcribeAudio(testAudioPath);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'pt',
        })
      );
    });
  });

  describe('analyzeSentiment', () => {
    it('deve analisar sentimento de texto positivo', async () => {
      const mockAnalysis = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                sentiment: 'positive',
                summary: 'Cliente muito satisfeito com o serviço',
                confidence: 0.98,
                keyPoints: ['Elogio ao atendimento', 'Satisfação com produto'],
                actionItems: ['Solicitar avaliação', 'Oferecer programa de fidelidade'],
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockAnalysis);

      const result = await analyzeSentiment('Adorei o atendimento! Produto excelente, muito obrigado!');

      expect(result.sentiment).toBe('positive');
      expect(result.summary).toContain('satisfeito');
      expect(result.confidence).toBe(0.98);
      expect(result.keyPoints).toHaveLength(2);
      expect(result.actionItems).toHaveLength(2);
    });

    it('deve analisar sentimento de texto negativo', async () => {
      const mockAnalysis = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                sentiment: 'negative',
                summary: 'Cliente extremamente insatisfeito',
                confidence: 0.96,
                keyPoints: ['Reclamação veemente', 'Ameaça de cancelamento'],
                actionItems: ['Ação imediata necessária', 'Contato urgente'],
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockAnalysis);

      const result = await analyzeSentiment('Péssimo atendimento! Vou cancelar e nunca mais volto!');

      expect(result.sentiment).toBe('negative');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('deve analisar sentimento de texto neutro', async () => {
      const mockAnalysis = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                sentiment: 'neutral',
                summary: 'Cliente fazendo pergunta objetiva',
                confidence: 0.85,
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockAnalysis);

      const result = await analyzeSentiment('Qual o horário de funcionamento?');

      expect(result.sentiment).toBe('neutral');
    });

    it('deve lidar com resposta malformada da IA', async () => {
      const mockAnalysis = {
        choices: [
          {
            message: {
              content: 'resposta inválida não-JSON',
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockAnalysis);

      const result = await analyzeSentiment('Texto qualquer');

      // Deve ter fallback
      expect(result.sentiment).toBeDefined();
      expect(['positive', 'negative', 'neutral']).toContain(result.sentiment);
    });

    it('deve lançar erro quando OpenAI não configurado', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      await expect(analyzeSentiment('Texto')).rejects.toThrow('OPENAI_API_KEY');

      process.env.OPENAI_API_KEY = originalKey;
    });
  });

  describe('processCallsBatch', () => {
    it('deve processar múltiplos áudios em lote', async () => {
      const mockTranscription = {
        text: 'Transcrição de teste',
      };

      const mockAnalysis = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                sentiment: 'positive',
                summary: 'Resumo',
                keyPoints: ['Ponto 1'],
                actionItems: ['Ação 1'],
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.audio.transcriptions.create).mockResolvedValue(mockTranscription);
      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockAnalysis);

      const audioPaths = [testAudioPath, testAudioPath, testAudioPath];
      const results = await processCallsBatch(audioPaths);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.status === 'completed')).toBe(true);
    });

    it('deve continuar processando mesmo se um áudio falhar', async () => {
      const mockTranscription = {
        text: 'Transcrição ok',
      };

      const mockAnalysis = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                sentiment: 'positive',
                summary: 'Ok',
              }),
            },
          },
        ],
      };

      // @ts-ignore
      vi.mocked(OpenAI.prototype.audio.transcriptions.create).mockResolvedValue(mockTranscription);
      // @ts-ignore
      vi.mocked(OpenAI.prototype.chat.completions.create).mockResolvedValue(mockAnalysis);

      const audioPaths = [testAudioPath, '/invalid/path.mp3', testAudioPath];
      const results = await processCallsBatch(audioPaths);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('completed');
      expect(results[1].status).toBe('failed');
      expect(results[2].status).toBe('completed');
    });

    it('deve retornar array vazio para entrada vazia', async () => {
      const results = await processCallsBatch([]);

      expect(results).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('deve lidar com timeout do OpenAI', async () => {
      // @ts-ignore
      vi.mocked(OpenAI.prototype.audio.transcriptions.create).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const result = await processCallAudio(testAudioPath, 'pt');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Timeout');
    });

    it('deve lidar com arquivo corrompido', async () => {
      // @ts-ignore
      vi.mocked(OpenAI.prototype.audio.transcriptions.create).mockRejectedValue(
        new Error('Invalid audio format')
      );

      const result = await processCallAudio(testAudioPath, 'pt');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Invalid audio format');
    });

    it('deve lidar com erro de rede', async () => {
      // @ts-ignore
      vi.mocked(OpenAI.prototype.audio.transcriptions.create).mockRejectedValue(
        new Error('Network error')
      );

      const result = await processCallAudio(testAudioPath, 'pt');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Network error');
    });
  });
});
