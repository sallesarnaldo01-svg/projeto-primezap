/**
 * Media Controller
 * Primeflow-Hub - Patch 4
 * 
 * Gerenciamento de upload e processamento de mídia
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { aiMediaService } from '../services/ai-media.service.js';

// Configuração do multer para upload
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'media');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'application/pdf',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não suportado'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

export const mediaController = {
  /**
   * Upload de arquivo único
   * POST /api/media/upload
   */
  async uploadSingle(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const file = req.file;
      const { tags = [], autoTag = true } = req.body;

      // Processar tags (se vier como string, converter para array)
      let tagsArray: string[] = [];
      if (typeof tags === 'string') {
        tagsArray = tags.split(',').map((t) => t.trim()).filter((t) => t);
      } else if (Array.isArray(tags)) {
        tagsArray = tags;
      }

      // Gerar thumbnail se for imagem
      let thumbnailUrl: string | null = null;
      if (file.mimetype.startsWith('image/')) {
        const thumbnailName = `thumb_${file.filename}`;
        const thumbnailPath = path.join(path.dirname(file.path), thumbnailName);

        await sharp(file.path)
          .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
          .toFile(thumbnailPath);

        thumbnailUrl = `/uploads/media/${thumbnailName}`;
      }

      // Auto-tagging com IA (se habilitado e for imagem)
      if (autoTag && file.mimetype.startsWith('image/')) {
        try {
          const aiTags = await aiMediaService.generateImageTags(file.path);
          tagsArray = [...new Set([...tagsArray, ...aiTags])];
        } catch (error) {
          console.error('Erro ao gerar tags com IA:', error);
          // Continuar mesmo se falhar
        }
      }

      // Salvar no banco de dados
      const media = await prisma.media.create({
        data: {
          tenantId,
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: `/uploads/media/${file.filename}`,
          thumbnailUrl,
          tags: tagsArray,
          metadata: {
            uploadedBy: req.user?.id,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      return res.status(201).json(media);
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      return res.status(500).json({ error: 'Erro ao fazer upload' });
    }
  },

  /**
   * Upload de múltiplos arquivos
   * POST /api/media/upload-multiple
   */
  async uploadMultiple(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const files = req.files as Express.Multer.File[];
      const { autoTag = true } = req.body;

      const mediaPromises = files.map(async (file) => {
        // Gerar thumbnail se for imagem
        let thumbnailUrl: string | null = null;
        if (file.mimetype.startsWith('image/')) {
          const thumbnailName = `thumb_${file.filename}`;
          const thumbnailPath = path.join(path.dirname(file.path), thumbnailName);

          await sharp(file.path)
            .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
            .toFile(thumbnailPath);

          thumbnailUrl = `/uploads/media/${thumbnailName}`;
        }

        // Auto-tagging com IA
        let tags: string[] = [];
        if (autoTag && file.mimetype.startsWith('image/')) {
          try {
            tags = await aiMediaService.generateImageTags(file.path);
          } catch (error) {
            console.error('Erro ao gerar tags com IA:', error);
          }
        }

        return prisma.media.create({
          data: {
            tenantId,
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url: `/uploads/media/${file.filename}`,
            thumbnailUrl,
            tags,
            metadata: {
              uploadedBy: req.user?.id,
              uploadedAt: new Date().toISOString(),
            },
          },
        });
      });

      const mediaList = await Promise.all(mediaPromises);

      return res.status(201).json({
        message: `${mediaList.length} arquivos enviados com sucesso`,
        data: mediaList,
      });
    } catch (error) {
      console.error('Erro ao fazer upload múltiplo:', error);
      return res.status(500).json({ error: 'Erro ao fazer upload múltiplo' });
    }
  },

  /**
   * Listar mídia com filtros
   * GET /api/media
   */
  async list(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      const {
        type,
        tags,
        search,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      // Construir filtros
      const where: any = { tenantId };

      if (type) {
        where.mimeType = { startsWith: type as string };
      }

      if (tags) {
        const tagsArray = (tags as string).split(',').map((t) => t.trim());
        where.tags = { hasSome: tagsArray };
      }

      if (search) {
        where.OR = [
          { originalName: { contains: search as string, mode: 'insensitive' } },
          { filename: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      // Buscar mídia
      const [mediaList, total] = await Promise.all([
        prisma.media.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { [sortBy as string]: sortOrder },
        }),
        prisma.media.count({ where }),
      ]);

      return res.json({
        data: mediaList,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      console.error('Erro ao listar mídia:', error);
      return res.status(500).json({ error: 'Erro ao listar mídia' });
    }
  },

  /**
   * Buscar mídia por ID
   * GET /api/media/:id
   */
  async getById(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      const { id } = req.params;

      const media = await prisma.media.findFirst({
        where: { id, tenantId },
      });

      if (!media) {
        return res.status(404).json({ error: 'Mídia não encontrada' });
      }

      return res.json(media);
    } catch (error) {
      console.error('Erro ao buscar mídia:', error);
      return res.status(500).json({ error: 'Erro ao buscar mídia' });
    }
  },

  /**
   * Atualizar tags de mídia
   * PATCH /api/media/:id/tags
   */
  async updateTags(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      const { id } = req.params;
      const { tags } = req.body;

      if (!Array.isArray(tags)) {
        return res.status(400).json({ error: 'Tags inválidas' });
      }

      // Verificar se mídia existe
      const existingMedia = await prisma.media.findFirst({
        where: { id, tenantId },
      });

      if (!existingMedia) {
        return res.status(404).json({ error: 'Mídia não encontrada' });
      }

      const media = await prisma.media.update({
        where: { id },
        data: { tags },
      });

      return res.json(media);
    } catch (error) {
      console.error('Erro ao atualizar tags:', error);
      return res.status(500).json({ error: 'Erro ao atualizar tags' });
    }
  },

  /**
   * Deletar mídia
   * DELETE /api/media/:id
   */
  async delete(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      const { id } = req.params;

      // Verificar se mídia existe
      const existingMedia = await prisma.media.findFirst({
        where: { id, tenantId },
      });

      if (!existingMedia) {
        return res.status(404).json({ error: 'Mídia não encontrada' });
      }

      // Deletar arquivos físicos
      try {
        const filePath = path.join(process.cwd(), 'uploads', 'media', existingMedia.filename);
        await fs.unlink(filePath);

        if (existingMedia.thumbnailUrl) {
          const thumbnailPath = path.join(
            process.cwd(),
            'uploads',
            'media',
            `thumb_${existingMedia.filename}`
          );
          await fs.unlink(thumbnailPath).catch(() => {});
        }
      } catch (error) {
        console.error('Erro ao deletar arquivo físico:', error);
      }

      // Deletar do banco
      await prisma.media.delete({ where: { id } });

      return res.status(204).send();
    } catch (error) {
      console.error('Erro ao deletar mídia:', error);
      return res.status(500).json({ error: 'Erro ao deletar mídia' });
    }
  },

  /**
   * Buscar mídia por tags
   * POST /api/media/search/by-tags
   */
  async searchByTags(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      const { tags, limit = 10 } = req.body;

      if (!Array.isArray(tags) || tags.length === 0) {
        return res.status(400).json({ error: 'Tags inválidas' });
      }

      const mediaList = await prisma.media.findMany({
        where: {
          tenantId,
          tags: { hasSome: tags },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return res.json(mediaList);
    } catch (error) {
      console.error('Erro ao buscar mídia por tags:', error);
      return res.status(500).json({ error: 'Erro ao buscar mídia' });
    }
  },

  /**
   * Obter todas as tags únicas
   * GET /api/media/tags
   */
  async getTags(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      const mediaList = await prisma.media.findMany({
        where: { tenantId },
        select: { tags: true },
      });

      const allTags = mediaList.flatMap((m) => m.tags);
      const uniqueTags = Array.from(new Set(allTags)).sort();

      return res.json(uniqueTags);
    } catch (error) {
      console.error('Erro ao buscar tags:', error);
      return res.status(500).json({ error: 'Erro ao buscar tags' });
    }
  },

  /**
   * Gerar tags automaticamente com IA
   * POST /api/media/:id/auto-tag
   */
  async autoTag(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      const { id } = req.params;

      // Buscar mídia
      const media = await prisma.media.findFirst({
        where: { id, tenantId },
      });

      if (!media) {
        return res.status(404).json({ error: 'Mídia não encontrada' });
      }

      if (!media.mimeType.startsWith('image/')) {
        return res.status(400).json({ error: 'Auto-tagging disponível apenas para imagens' });
      }

      // Gerar tags com IA
      const filePath = path.join(process.cwd(), 'uploads', 'media', media.filename);
      const aiTags = await aiMediaService.generateImageTags(filePath);

      // Mesclar com tags existentes
      const allTags = [...new Set([...media.tags, ...aiTags])];

      // Atualizar mídia
      const updatedMedia = await prisma.media.update({
        where: { id },
        data: { tags: allTags },
      });

      return res.json({
        ...updatedMedia,
        newTags: aiTags,
      });
    } catch (error) {
      console.error('Erro ao gerar tags automaticamente:', error);
      return res.status(500).json({ error: 'Erro ao gerar tags automaticamente' });
    }
  },
};

