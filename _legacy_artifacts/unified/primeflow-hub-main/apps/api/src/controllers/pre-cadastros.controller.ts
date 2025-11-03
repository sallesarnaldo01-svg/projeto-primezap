import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import type { JWTPayload } from '@primeflow/shared/types';

type AuthenticatedRequest = Request & { user?: JWTPayload };

function ensureAuth(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return null;
  }
  return { tenantId: req.user.tenantId, userId: req.user.userId };
}

async function safeQuery<T>(fn: () => Promise<T>, fallback: T, warn: string, extra?: Record<string, unknown>) {
  try {
    return await fn();
  } catch (err) {
    logger.warn({ err, ...extra }, warn);
    return fallback;
  }
}

export const preCadastrosController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { leadId, correspondente_id, empreendimento } = req.query as any;
    const rows = await prisma.pre_cadastros.findMany({
      where: {
        tenantId: auth.tenantId,
        leadId: leadId || undefined,
        correspondenteId: correspondente_id || undefined,
        empreendimento: empreendimento ? { contains: empreendimento, mode: 'insensitive' } : undefined,
      },
      orderBy: { createdAt: 'desc' },
      include: { documentos: { select: { status: true } } },
    });
    const data = rows.map((r) => {
      const total = r.documentos.length;
      const approved = r.documentos.filter((d) => d.status === 'APROVADO').length;
      const percentual = total > 0 ? Math.round((approved / total) * 100) : 0;
      return {
        id: r.id,
        status: r.status,
        empreendimento: r.empreendimento ?? null,
        bloco: r.bloco ?? null,
        unidade: r.unidade ?? null,
        rendaMensal: r.rendaMensal ?? null,
        prestacaoValor: r.prestacaoValor ?? null,
        vencimentoAprovacao: r.vencimentoAprovacao ?? null,
        leadId: r.leadId ?? null,
        leadName: r.leadName ?? null,
        correspondenteId: r.correspondenteId ?? null,
        correspondenteName: r.correspondenteName ?? null,
        createdAt: r.createdAt ?? null,
        percentualDocumentos: percentual,
      };
    });
    res.json(data);
  },

  async getById(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { id } = req.params;
    const item = await safeQuery(async () => {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM public.pre_cadastros WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
        auth.tenantId,
        id,
      );
      return rows[0] ?? null;
    }, null, 'pre_cadastros.getById fallback', { id });
    if (!item) return res.status(404).json({ error: 'Não encontrado' });
    // percentual via função
    const percentualDocs = await safeQuery(async () => {
      return await prisma.$queryRawUnsafe<any[]>(`SELECT public.calcular_percentual_documentos($1) as percentual`, id);
    }, [{ percentual: 0 }], 'pre_cadastros.percentual fallback', { id });

    res.json({
      id: item.id,
      status: item.status,
      empreendimento: item.empreendimento ?? null,
      bloco: item.bloco ?? null,
      unidade: item.unidade ?? null,
      rendaMensal: item.renda_mensal ?? null,
      rendaFamiliar: item.renda_familiar ?? null,
      prestacaoValor: item.prestacao_valor ?? null,
      avaliacaoValor: item.avaliacao_valor ?? null,
      aprovadoValor: item.aprovado_valor ?? null,
      subsidioValor: item.subsidio_valor ?? null,
      fgtsValor: item.fgts_valor ?? null,
      prazoMeses: item.prazo_meses ?? null,
      vencimentoAprovacao: item.vencimento_aprovacao ?? null,
      leadId: item.lead_id ?? null,
      leadName: item.lead_name ?? null,
      correspondenteId: item.correspondente_id ?? null,
      correspondenteName: item.correspondente_name ?? null,
      createdAt: item.created_at ?? null,
      observacoes: item.observacoes ?? null,
      percentualDocumentos: percentualDocs?.[0]?.percentual ?? 0,
    });
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const b = req.body ?? {};
    const created = await safeQuery(async () => {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `INSERT INTO public.pre_cadastros (tenant_id, status, empreendimento, bloco, unidade, renda_mensal, prestacao_valor, lead_id, observacoes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        auth.tenantId, b.status ?? 'NOVA_AVALIACAO', b.empreendimento ?? null, b.bloco ?? null, b.unidade ?? null,
        b.rendaMensal ?? null, b.prestacaoValor ?? null, b.leadId ?? null, b.observacoes ?? null,
      );
      return rows[0];
    }, null, 'pre_cadastros.create fallback');
    if (!created) return res.status(501).json({ error: 'Tabela não disponível' });
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.notifications (tenant_id, type, data) VALUES ($1,$2,$3)`,
        auth.tenantId,
        'PRECADASTRO_CREATED',
        JSON.stringify({ id: created.id, empreendimento: created.empreendimento, leadId: created.lead_id }),
      );
    } catch {}
    res.status(201).json({ id: created.id, status: created.status, empreendimento: created.empreendimento, bloco: created.bloco, unidade: created.unidade, leadId: created.lead_id });
  },

  async assignCorrespondente(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { id } = req.params;
    const { correspondenteId, userId } = req.body ?? {};
    const ok = await safeQuery(async () => {
      await prisma.$executeRawUnsafe(
        `UPDATE public.pre_cadastros SET correspondente_id = $1, correspondente_usuario_id = $2 WHERE tenant_id = $3 AND id = $4`,
        correspondenteId ?? null, userId ?? null, auth.tenantId, id,
      );
      return true;
    }, false, 'pre_cadastros.assignCorrespondente fallback', { id });
    if (!ok) return res.status(501).json({ error: 'Tabela não disponível' });
    res.status(200).json({ success: true });
  },
};
