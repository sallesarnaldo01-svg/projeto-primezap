/**
 * Products Controller
 * Primeflow-Hub - Patch 4
 * 
 * Gerenciamento completo de produtos e catálogo
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

// Schemas de validação
const createProductSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  sku: z.string().optional(),
  price: z.number().positive('Preço deve ser positivo'),
  compareAtPrice: z.number().positive().optional(),
  cost: z.number().positive().optional(),
  stock: z.number().int().min(0, 'Estoque não pode ser negativo').optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  active: z.boolean().optional().default(true),
  metadata: z.record(z.any()).optional(),
});

const updateProductSchema = createProductSchema.partial();

const searchProductsSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  active: z.boolean().optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
  sortBy: z.enum(['name', 'price', 'stock', 'createdAt', 'updatedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const productsController = {
  /**
   * Criar novo produto
   * POST /api/products
   */
  async create(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      const data = createProductSchema.parse(req.body);

      const product = await prisma.product.create({
        data: {
          name: data.name,
          description: data.description,
          sku: data.sku,
          price: data.price,
          compareAtPrice: data.compareAtPrice,
          cost: data.cost,
          stock: data.stock ?? 0,
          category: data.category,
          tags: data.tags || [],
          images: data.images || [],
          active: data.active ?? true,
          metadata: data.metadata || {},
          tenant: { connect: { id: tenantId } },
        },
        include: {
          media: true,
          _count: {
            select: { media: true },
          },
        },
      });

      return res.status(201).json(product);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
      }
      console.error('Erro ao criar produto:', error);
      return res.status(500).json({ error: 'Erro ao criar produto' });
    }
  },

  /**
   * Listar produtos com filtros e paginação
   * GET /api/products
   */
  async list(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      const params = searchProductsSchema.parse({
        ...req.query,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,
      });

      const { page, limit, sortBy, sortOrder, ...filters } = params;
      const skip = (page - 1) * limit;

      // Construir filtros
      const where: any = { tenantId };

      if (filters.query) {
        where.OR = [
          { name: { contains: filters.query, mode: 'insensitive' } },
          { description: { contains: filters.query, mode: 'insensitive' } },
          { sku: { contains: filters.query, mode: 'insensitive' } },
        ];
      }

      if (filters.category) {
        where.category = filters.category;
      }

      if (filters.tags && filters.tags.length > 0) {
        where.tags = { hasSome: filters.tags };
      }

      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        where.price = {};
        if (filters.minPrice !== undefined) where.price.gte = filters.minPrice;
        if (filters.maxPrice !== undefined) where.price.lte = filters.maxPrice;
      }

      if ((filters as any).active !== undefined) {
        where.active = (filters as any).active;
      }

      // Buscar produtos
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            media: true,
            _count: {
              select: { media: true },
            },
          },
        }),
        prisma.product.count({ where }),
      ]);

      return res.json({
        data: products,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Parâmetros inválidos', details: error.errors });
      }
      console.error('Erro ao listar produtos:', error);
      return res.status(500).json({ error: 'Erro ao listar produtos' });
    }
  },

  /**
   * Buscar produto por ID
   * GET /api/products/:id
   */
  async getById(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      const { id } = req.params;

      const product = await prisma.product.findFirst({
        where: { id, tenantId },
        include: {
          media: true,
          _count: {
            select: { media: true },
          },
        },
      });

      if (!product) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      return res.json(product);
    } catch (error) {
      console.error('Erro ao buscar produto:', error);
      return res.status(500).json({ error: 'Erro ao buscar produto' });
    }
  },

  /**
   * Atualizar produto
   * PUT /api/products/:id
   */
  async update(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      const { id } = req.params;
      const data = updateProductSchema.parse(req.body);

      // Verificar se produto existe
      const existingProduct = await prisma.product.findFirst({
        where: { id, tenantId },
      });

      if (!existingProduct) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      const product = await prisma.product.update({
        where: { id },
        data,
        include: {
          media: true,
          _count: {
            select: { media: true },
          },
        },
      });

      return res.json(product);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
      }
      console.error('Erro ao atualizar produto:', error);
      return res.status(500).json({ error: 'Erro ao atualizar produto' });
    }
  },

  /**
   * Deletar produto
   * DELETE /api/products/:id
   */
  async delete(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      const { id } = req.params;

      // Verificar se produto existe
      const existingProduct = await prisma.product.findFirst({
        where: { id, tenantId },
      });

      if (!existingProduct) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      await prisma.product.delete({ where: { id } });

      return res.status(204).send();
    } catch (error) {
      console.error('Erro ao deletar produto:', error);
      return res.status(500).json({ error: 'Erro ao deletar produto' });
    }
  },

  /**
   * Buscar produtos por tags
   * POST /api/products/search/by-tags
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

      const products = await prisma.product.findMany({
        where: {
          tenantId,
          active: true,
          tags: { hasSome: tags },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          compareAtPrice: true,
          images: true,
          tags: true,
          stock: true,
        },
      });

      return res.json(products);
    } catch (error) {
      console.error('Erro ao buscar produtos por tags:', error);
      return res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
  },

  /**
   * Obter categorias únicas
   * GET /api/products/categories
   */
  async getCategories(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      const categories = await prisma.product.findMany({
        where: { tenantId, category: { not: null } },
        select: { category: true },
        distinct: ['category'],
      });

      const categoryList = categories
        .map((p) => p.category)
        .filter((c): c is string => c !== null)
        .sort();

      return res.json(categoryList);
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
      return res.status(500).json({ error: 'Erro ao buscar categorias' });
    }
  },

  /**
   * Obter tags únicas
   * GET /api/products/tags
   */
  async getTags(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      const products = await prisma.product.findMany({
        where: { tenantId },
        select: { tags: true },
      });

      const allTags = products.flatMap((p) => p.tags);
      const uniqueTags = Array.from(new Set(allTags)).sort();

      return res.json(uniqueTags);
    } catch (error) {
      console.error('Erro ao buscar tags:', error);
      return res.status(500).json({ error: 'Erro ao buscar tags' });
    }
  },

  /**
   * Atualizar estoque de produto
   * PATCH /api/products/:id/stock
   */
  async updateStock(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      const { id } = req.params;
      const { stock, operation = 'set' } = req.body;

      if (typeof stock !== 'number' || stock < 0) {
        return res.status(400).json({ error: 'Estoque inválido' });
      }

      // Verificar se produto existe
      const existingProduct = await prisma.product.findFirst({
        where: { id, tenantId },
      });

      if (!existingProduct) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      let newStock = stock;
      if (operation === 'add') {
        newStock = (existingProduct.stock || 0) + stock;
      } else if (operation === 'subtract') {
        newStock = Math.max(0, (existingProduct.stock || 0) - stock);
      }

      const product = await prisma.product.update({
        where: { id },
        data: { stock: newStock },
      });

      return res.json(product);
    } catch (error) {
      console.error('Erro ao atualizar estoque:', error);
      return res.status(500).json({ error: 'Erro ao atualizar estoque' });
    }
  },

  /**
   * Importar produtos em massa
   * POST /api/products/bulk-import
   */
  async bulkImport(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      const { products } = req.body;

      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: 'Lista de produtos inválida' });
      }

      // Validar cada produto
      const validatedProducts = products.map((p) => createProductSchema.parse(p));

      // Criar produtos em lote
      const created = await prisma.product.createMany({
        data: validatedProducts.map((p) => ({
          name: p.name,
          description: p.description,
          sku: p.sku,
          price: p.price,
          compareAtPrice: p.compareAtPrice,
          cost: p.cost,
          stock: p.stock ?? 0,
          category: p.category,
          tags: p.tags || [],
          images: p.images || [],
          active: p.active ?? true,
          metadata: p.metadata || {},
          tenantId,
        })),
        skipDuplicates: true,
      });

      return res.status(201).json({
        message: `${created.count} produtos importados com sucesso`,
        count: created.count,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
      }
      console.error('Erro ao importar produtos:', error);
      return res.status(500).json({ error: 'Erro ao importar produtos' });
    }
  },
};
