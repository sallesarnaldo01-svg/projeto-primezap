import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const propertiesController = {
  async list(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { type, transactionType, status, city, minPrice, maxPrice, bedrooms, page = '1', limit = '20', search } = req.query as Record<string, string>;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const where: any = { tenantId };

      if (type) where.type = type;
      if (transactionType) where.transactionType = transactionType;
      if (status) where.status = status;
      if (city) where.city = city;
      if (bedrooms) where.bedrooms = { gte: parseInt(bedrooms) };
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (minPrice || maxPrice) {
        where.price = {};
        if (minPrice) where.price.gte = parseFloat(minPrice);
        if (maxPrice) where.price.lte = parseFloat(maxPrice);
      }

      const [properties, total] = await Promise.all([
        prisma.properties.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
        prisma.properties.count({ where })
      ]);

      res.json({ data: properties, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
    } catch (error) {
      logger.error({ error }, 'Error listing properties');
      res.status(500).json({ error: 'Failed to list properties' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      const property = await prisma.properties.findFirst({ where: { id, tenantId } });
      if (!property) return res.status(404).json({ error: 'Property not found' });
      res.json({ data: property });
    } catch (error) {
      logger.error({ error }, 'Error getting property');
      res.status(500).json({ error: 'Failed to get property' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId!;
      const userId = req.user?.userId!;
      const property = await prisma.properties.create({ data: { ...req.body, tenantId, brokerId: userId } });
      logger.info({ propertyId: property.id }, 'Property created');
      res.status(201).json({ data: property });
    } catch (error) {
      logger.error({ error }, 'Error creating property');
      res.status(500).json({ error: 'Failed to create property' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId!;
      const updated = await prisma.properties.updateMany({ where: { id, tenantId }, data: req.body });
      if (updated.count === 0) return res.status(404).json({ error: 'Property not found' });
      const property = await prisma.properties.findFirst({ where: { id, tenantId } });
      res.json({ data: property });
    } catch (error) {
      logger.error({ error }, 'Error updating property');
      res.status(500).json({ error: 'Failed to update property' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId!;
      const result = await prisma.properties.deleteMany({ where: { id, tenantId } });
      if (result.count === 0) return res.status(404).json({ error: 'Property not found' });
      res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting property');
      res.status(500).json({ error: 'Failed to delete property' });
    }
  },

  async generateDescription(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { tone = 'professional' } = req.body as { tone?: string };
      const tenantId = req.user?.tenantId!;

      const property = await prisma.properties.findFirst({ where: { id, tenantId } });
      if (!property) return res.status(404).json({ error: 'Property not found' });

      const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/ai-property-description`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ propertyData: property, tone })
      });

      if (!response.ok) throw new Error('Failed to generate description');
      const { content } = await response.json();

      await prisma.properties.update({
        where: { id },
        data: {
          title: content.title ?? property.title,
          description: content.description ?? property.description,
          metadata: {
            ...((property.metadata as any) || {}),
            aiGenerated: {
              highlights: content.highlights,
              keywords: content.keywords,
              shortDescription: content.shortDescription,
              generatedAt: new Date().toISOString()
            }
          }
        }
      });

      res.json({ data: content });
    } catch (error) {
      logger.error({ error }, 'Error generating description');
      res.status(500).json({ error: 'Failed to generate description' });
    }
  }
};
