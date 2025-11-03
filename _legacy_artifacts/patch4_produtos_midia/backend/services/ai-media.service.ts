/**
 * AI Media Service
 * Primeflow-Hub - Patch 4
 * 
 * Processamento de mídia com IA (Gemini 2.5 Flash)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';

// Inicializar Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const aiMediaService = {
  /**
   * Gerar tags automaticamente para uma imagem usando Gemini Vision
   */
  async generateImageTags(imagePath: string): Promise<string[]> {
    try {
      if (!process.env.GEMINI_API_KEY) {
        console.warn('GEMINI_API_KEY não configurada, retornando tags vazias');
        return [];
      }

      // Ler imagem como base64
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.getMimeTypeFromPath(imagePath);

      // Usar modelo Gemini 2.5 Flash
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `Analise esta imagem e gere tags descritivas em português.
      
Retorne APENAS uma lista de tags separadas por vírgula, sem numeração ou formatação adicional.
As tags devem ser:
- Específicas e descritivas
- Em português
- Relevantes para e-commerce
- Incluir: tipo de produto, cores, estilo, características visuais

Exemplo de resposta: "camiseta, azul, casual, algodão, manga curta, estampada"

Agora analise a imagem:`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType,
            data: base64Image,
          },
        },
      ]);

      const response = await result.response;
      const text = response.text();

      // Processar resposta
      const tags = text
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0 && tag.length < 50)
        .slice(0, 10); // Limitar a 10 tags

      return tags;
    } catch (error) {
      console.error('Erro ao gerar tags com IA:', error);
      return [];
    }
  },

  /**
   * Gerar descrição de produto a partir de imagem
   */
  async generateProductDescription(imagePath: string, productName?: string): Promise<string> {
    try {
      if (!process.env.GEMINI_API_KEY) {
        console.warn('GEMINI_API_KEY não configurada');
        return '';
      }

      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.getMimeTypeFromPath(imagePath);

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `Analise esta imagem de produto${productName ? ` (${productName})` : ''} e gere uma descrição atraente para e-commerce.

A descrição deve:
- Ter 2-3 parágrafos
- Destacar características visuais
- Mencionar possíveis usos
- Ser persuasiva mas honesta
- Estar em português

Retorne APENAS a descrição, sem títulos ou formatação adicional.`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType,
            data: base64Image,
          },
        },
      ]);

      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Erro ao gerar descrição com IA:', error);
      return '';
    }
  },

  /**
   * Analisar qualidade da imagem
   */
  async analyzeImageQuality(imagePath: string): Promise<{
    score: number;
    issues: string[];
    suggestions: string[];
  }> {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return {
          score: 0,
          issues: ['API Key não configurada'],
          suggestions: [],
        };
      }

      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.getMimeTypeFromPath(imagePath);

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `Analise a qualidade desta imagem de produto para uso em e-commerce.

Avalie:
1. Resolução e nitidez
2. Iluminação
3. Enquadramento
4. Fundo
5. Profissionalismo geral

Retorne a resposta EXATAMENTE neste formato JSON:
{
  "score": <número de 0 a 10>,
  "issues": ["problema 1", "problema 2"],
  "suggestions": ["sugestão 1", "sugestão 2"]
}`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType,
            data: base64Image,
          },
        },
      ]);

      const response = await result.response;
      const text = response.text();

      // Tentar extrair JSON da resposta
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return {
          score: analysis.score || 0,
          issues: analysis.issues || [],
          suggestions: analysis.suggestions || [],
        };
      }

      return {
        score: 5,
        issues: ['Não foi possível analisar a imagem'],
        suggestions: [],
      };
    } catch (error) {
      console.error('Erro ao analisar qualidade da imagem:', error);
      return {
        score: 0,
        issues: ['Erro ao processar análise'],
        suggestions: [],
      };
    }
  },

  /**
   * Detectar objetos/produtos na imagem
   */
  async detectObjects(imagePath: string): Promise<string[]> {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return [];
      }

      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.getMimeTypeFromPath(imagePath);

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `Liste todos os objetos/produtos visíveis nesta imagem.

Retorne APENAS uma lista separada por vírgula, sem numeração ou formatação.
Seja específico e use nomes em português.

Exemplo: "camiseta, jeans, tênis, relógio, óculos"`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType,
            data: base64Image,
          },
        },
      ]);

      const response = await result.response;
      const text = response.text();

      const objects = text
        .split(',')
        .map((obj) => obj.trim().toLowerCase())
        .filter((obj) => obj.length > 0);

      return objects;
    } catch (error) {
      console.error('Erro ao detectar objetos:', error);
      return [];
    }
  },

  /**
   * Sugerir categoria de produto baseado na imagem
   */
  async suggestCategory(imagePath: string): Promise<string> {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return 'Geral';
      }

      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.getMimeTypeFromPath(imagePath);

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `Analise esta imagem e sugira UMA categoria de produto para e-commerce.

Categorias possíveis:
- Roupas
- Calçados
- Acessórios
- Eletrônicos
- Casa e Decoração
- Beleza e Cuidados
- Esportes
- Livros
- Alimentos
- Outros

Retorne APENAS o nome da categoria, sem explicações.`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType,
            data: base64Image,
          },
        },
      ]);

      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Erro ao sugerir categoria:', error);
      return 'Geral';
    }
  },

  /**
   * Obter MIME type a partir do caminho do arquivo
   */
  getMimeTypeFromPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    return mimeTypes[ext] || 'image/jpeg';
  },

  /**
   * Processar imagem completa (tags + descrição + qualidade)
   */
  async processImage(imagePath: string, productName?: string): Promise<{
    tags: string[];
    description: string;
    category: string;
    quality: {
      score: number;
      issues: string[];
      suggestions: string[];
    };
  }> {
    try {
      const [tags, description, category, quality] = await Promise.all([
        this.generateImageTags(imagePath),
        this.generateProductDescription(imagePath, productName),
        this.suggestCategory(imagePath),
        this.analyzeImageQuality(imagePath),
      ]);

      return {
        tags,
        description,
        category,
        quality,
      };
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      return {
        tags: [],
        description: '',
        category: 'Geral',
        quality: {
          score: 0,
          issues: ['Erro ao processar'],
          suggestions: [],
        },
      };
    }
  },
};

