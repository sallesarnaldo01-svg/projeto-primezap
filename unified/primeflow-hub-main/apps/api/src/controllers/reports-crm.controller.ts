import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import type { JWTPayload } from '@primeflow/shared/types';

type AuthenticatedRequest = Request & { user?: JWTPayload };

function ensure(req: AuthenticatedRequest, res: Response) {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return null; }
  return { tenantId: req.user.tenantId };
}

export const reportsCrmController = {
  async metrics(req: AuthenticatedRequest, res: Response) {
    const auth = ensure(req, res); if (!auth) return;
    const tenantId = auth.tenantId;

    const [leadStatus, preStatus, dealsByStage, dealsValue, upcomingAppointments, docsPending] = await Promise.all([
      prisma.$queryRawUnsafe<{ status: string; count: number }[]>(
        `SELECT COALESCE(status,'unknown') AS status, COUNT(*)::int AS count FROM public.contacts WHERE tenant_id = $1 GROUP BY status`, tenantId,
      ),
      prisma.$queryRawUnsafe<{ status: string; count: number }[]>(
        `SELECT status, COUNT(*)::int AS count FROM public.pre_cadastros WHERE tenant_id = $1 GROUP BY status`, tenantId,
      ),
      prisma.$queryRawUnsafe<{ stage: string; count: number }[]>(
        `SELECT COALESCE(stage_id::text,'none') AS stage, COUNT(*)::int AS count FROM public.deals WHERE tenant_id = $1 GROUP BY stage_id`, tenantId,
      ).catch(() => [] as any),
      prisma.$queryRawUnsafe<{ total: string }[]>(
        `SELECT COALESCE(SUM(value),0)::text AS total FROM public.deals WHERE tenant_id = $1`, tenantId,
      ).catch(() => [{ total: '0' }] as any),
      prisma.$queryRawUnsafe<{ count: number }[]>(
        `SELECT COUNT(*)::int AS count FROM public.appointments WHERE tenant_id = $1 AND start_at >= now() AND start_at < now() + interval '7 days'`, tenantId,
      ).catch(() => [{ count: 0 }] as any),
      prisma.$queryRawUnsafe<{ pre_cadastro_id: string | null; pendentes: number }[]>(
        `SELECT pre_cadastro_id, COUNT(*)::int AS pendentes FROM public.documentos_pre_cadastro WHERE tenant_id = $1 AND status <> 'APROVADO' GROUP BY pre_cadastro_id`, tenantId,
      ).catch(() => [] as any),
    ]);

    const approvalRateRow = await prisma.$queryRawUnsafe<{ approved: number; total: number }[]>(
      `SELECT COALESCE(SUM(CASE WHEN status = 'APROVADO' THEN 1 ELSE 0 END),0)::int AS approved,
              COUNT(*)::int AS total
       FROM public.pre_cadastros WHERE tenant_id = $1`, tenantId,
    );
    const approvalRate = approvalRateRow[0]?.total ? approvalRateRow[0].approved / approvalRateRow[0].total : 0;

    res.json({
      leads: { byStatus: leadStatus },
      preCadastros: { byStatus: preStatus, approvalRate },
      deals: { byStage: dealsByStage, totalValue: Number(dealsValue?.[0]?.total ?? '0') },
      appointments: { upcoming7d: upcomingAppointments?.[0]?.count ?? 0 },
      documents: { pendingByPreCadastro: docsPending },
      generatedAt: new Date().toISOString(),
    });
  },
};

