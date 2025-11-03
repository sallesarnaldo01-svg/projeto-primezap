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
        `SELECT COALESCE(lead_status,'unknown') AS status, COUNT(*)::int AS count FROM public.contacts WHERE tenant_id = $1 GROUP BY lead_status`, tenantId,
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
        `SELECT COUNT(*)::int AS count
         FROM public.appointments a
         JOIN public.public_users u ON u.id = a.user_id
         WHERE u.tenant_id = $1
           AND a.scheduled_at >= now()
           AND a.scheduled_at < now() + interval '7 days'`, tenantId,
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

  async exportLeadsCsv(req: AuthenticatedRequest, res: Response) {
    const auth = ensure(req, res); if (!auth) return;
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, name, email, phone, origem AS origin, lead_status AS status, user_id AS owner_id, created_at
       FROM public.contacts
       WHERE tenant_id = $1
       ORDER BY created_at DESC
      `,
      auth.tenantId,
    );
    const headers = ['id','name','email','phone','origin','status','ownerId','createdAt'];
    const csv = [headers.join(','), ...rows.map(r => [
      r.id,
      safeCsv(r.name),
      r.email ?? '',
      r.phone ?? '',
      r.origin ?? 'manual',
      r.status ?? 'novo',
      r.owner_id ?? '',
      r.created_at?.toISOString?.() ?? r.created_at ?? ''
    ].join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send(csv);
  },

  async exportPreCadastrosCsv(req: AuthenticatedRequest, res: Response) {
    const auth = ensure(req, res); if (!auth) return;
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, numero, status, empreendimento, bloco, unidade, renda_mensal, prestacao_valor, lead_id, created_at
       FROM public.pre_cadastros
       WHERE tenant_id = $1
       ORDER BY created_at DESC
      `,
      auth.tenantId,
    );
    const headers = ['id','numero','status','empreendimento','bloco','unidade','rendaMensal','prestacaoValor','leadId','createdAt'];
    const csv = [headers.join(','), ...rows.map(r => [
      r.id,
      r.numero ?? '',
      r.status ?? '',
      safeCsv(r.empreendimento),
      r.bloco ?? '',
      r.unidade ?? '',
      r.renda_mensal ?? '',
      r.prestacao_valor ?? '',
      r.lead_id ?? '',
      r.created_at?.toISOString?.() ?? r.created_at ?? ''
    ].join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="pre-cadastros.csv"');
    res.send(csv);
  },

  async exportSummaryPdf(req: AuthenticatedRequest, res: Response) {
    const auth = ensure(req, res); if (!auth) return;
    // reuse metrics quickly
    const metricsReq: any = { ...req };
    const data: any = {};
    try {
      const [leadStatus, preStatus] = await Promise.all([
        prisma.$queryRawUnsafe<{ status: string; count: number }[]>(
          `SELECT COALESCE(status,'unknown') AS status, COUNT(*)::int AS count FROM public.contacts WHERE tenant_id = $1 GROUP BY status`, auth.tenantId,
        ).catch(() => []),
        prisma.$queryRawUnsafe<{ status: string; count: number }[]>(
          `SELECT status, COUNT(*)::int AS count FROM public.pre_cadastros WHERE tenant_id = $1 GROUP BY status`, auth.tenantId,
        ).catch(() => []),
      ]);
      data.leads = leadStatus;
      data.pre = preStatus;
    } catch {}
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const draw = (text: string, x: number, y: number, size = 12) => {
      page.drawText(text, { x, y, size, font });
    };
    let y = 800;
    draw('Relatório CRM (Resumo)', 40, y, 18); y -= 24;
    draw(`Gerado em: ${new Date().toISOString()}`, 40, y); y -= 30;
    draw('Leads por status:', 40, y); y -= 18;
    for (const r of data.leads ?? []) { draw(`- ${r.status}: ${r.count}`, 60, y); y -= 16; }
    y -= 10;
    draw('Pré‑cadastros por status:', 40, y); y -= 18;
    for (const r of data.pre ?? []) { draw(`- ${r.status}: ${r.count}`, 60, y); y -= 16; }
    const bytes = await pdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="crm-summary.pdf"');
    res.send(Buffer.from(bytes));
  },
};

function safeCsv(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}` + '"' : s;
}
