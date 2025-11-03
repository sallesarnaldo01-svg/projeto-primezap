import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import * as Boom from '@hapi/boom';
import { env } from '../config/env.js';
import { supabase } from '../lib/supabase.js';

export const knowledgeController = {
  // GET /ai/knowledge - Listar documentos
  async list(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { agentId, type } = req.query;

      const docs = await prisma.knowledgeDocument.findMany({
        where: {
          tenantId,
          ...(agentId && { agentId: agentId as string }),
          ...(type && { type: type as string })
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(docs);
    } catch (error) {
      logger.error({ error }, 'Erro ao listar documentos');
      throw Boom.internal('Erro ao listar documentos');
    }
  },

  // POST /ai/knowledge - Criar documento
  async create(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { name, type, fileUrl, content, agentId, tags, metadata } = req.body;

      const doc = await prisma.knowledgeDocument.create({
        data: {
          tenantId,
          name,
          type,
          fileUrl,
          content,
          agentId,
          tags: tags || [],
          metadata
        }
      });

      logger.info({ docId: doc.id }, 'Documento de conhecimento criado');
      res.status(201).json(doc);
    } catch (error) {
      logger.error({ error }, 'Erro ao criar documento');
      throw error;
    }
  },

  // DELETE /ai/knowledge/:id - Deletar documento
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      const doc = await prisma.knowledgeDocument.findFirst({
        where: { id, tenantId }
      });

      if (!doc) {
        throw Boom.notFound('Documento não encontrado');
      }

      await prisma.knowledgeDocument.delete({
        where: { id }
      });

      logger.info({ docId: id }, 'Documento deletado');
      res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Erro ao deletar documento');
      throw error;
    }
  },

  // POST /ai/knowledge/search - Busca semântica (RAG)
  async search(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { query, agentId, limit = 5 } = req.body;
      const searchLimit = Math.max(1, Math.min(Number(limit) || 5, 20));

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw Boom.badRequest('Consulta de busca inválida');
      }

      const buildResponse = (documents: Array<any>) => ({
        query,
        results: documents.map((doc) => ({
          id: doc.id,
          name: doc.name,
          type: doc.type,
          content: doc.content?.substring(0, 500) ?? null,
          relevance: doc.relevance ?? 0
        }))
      });

      const fallbackSearch = async () => {
        const docs = await prisma.knowledgeDocument.findMany({
          where: {
            tenantId,
            ...(agentId && { agentId }),
            content: {
              contains: query,
              mode: 'insensitive'
            }
          },
          take: searchLimit,
          orderBy: { createdAt: 'desc' }
        });

        return buildResponse(docs);
      };

      if (!env.OPENAI_API_KEY) {
        logger.warn('OPENAI_API_KEY not configured, using fallback knowledge search');
        const response = await fallbackSearch();
        return res.json(response);
      }

      let OpenAIClient: typeof import('openai').OpenAI | undefined;
      try {
        const mod = await import('openai');
        OpenAIClient = mod.OpenAI;
      } catch (error) {
        logger.error({ error }, 'openai package not installed, using fallback search');
        const response = await fallbackSearch();
        return res.json(response);
      }

      const openai = new OpenAIClient({ apiKey: env.OPENAI_API_KEY });

      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query
      });

      const queryEmbedding = embeddingResponse.data?.[0]?.embedding;

      if (!queryEmbedding) {
        logger.warn('OpenAI embedding response did not return data, falling back to text search');
        const response = await fallbackSearch();
        return res.json(response);
      }

      const { data: matches, error: matchError } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: searchLimit
      });

      if (matchError) {
        logger.error({ error: matchError }, 'Knowledge search RPC failed, using fallback search');
        const response = await fallbackSearch();
        return res.json(response);
      }

      const matchList: Array<any> = Array.isArray(matches) ? matches : [];
      const documentIds = matchList
        .map((match) => match.document_id ?? match.id)
        .filter(Boolean);

      const documents = documentIds.length
        ? await prisma.knowledgeDocument.findMany({
            where: {
              tenantId,
              id: { in: documentIds },
              ...(agentId && { agentId })
            }
          })
        : [];

      const documentsById = new Map(documents.map((doc) => [doc.id, doc]));
      const enriched = matchList
        .map((match) => {
          const docId = match.document_id ?? match.id;
          const doc = documentsById.get(docId);
          if (!doc) return null;

          return {
            ...doc,
            relevance:
              match.similarity ??
              match.score ??
              match.match_score ??
              match.distance ??
              0
          };
        })
        .filter(Boolean);

      const response = buildResponse(enriched.length ? enriched : documents);
      res.json(response);
    } catch (error) {
      logger.error({ error }, 'Erro na busca RAG');
      throw error;
    }
  }
};
