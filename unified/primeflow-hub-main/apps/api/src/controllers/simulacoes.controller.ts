import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import type { JWTPayload } from '@primeflow/shared/types';

type AuthenticatedRequest = Request & { user?: JWTPayload };

function ensureAuth(req: AuthenticatedRequest, res: Response) {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return null; }
  return { tenantId: req.user.tenantId };
}

function calcPrice(P: number, i: number, n: number) {
  const r = i / 12 / 100;
  return P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function calcSac(P: number, i: number, n: number) {
  const amort = P / n;
  const r = i / 12 / 100;
  const first = amort + P * r;
  return first; // mostrar apenas primeira prestação
}

export const simulacoesController = {
  async calcular(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const b = req.body ?? {};
    const valorFinanciado = Math.max(0, (Number(b.valorImovel) || 0) - (Number(b.valorEntrada) || 0) - (Number(b.valorFgts) || 0) - (Number(b.valorSubsidio) || 0));
    const n = Number(b.prazoMeses) || 360;
    const taxa = Number(b.taxaJuros) || 10.5;
    const sistema = (b.sistemaAmortizacao as 'SAC' | 'PRICE') || 'SAC';
    const valorPrestacao = sistema === 'PRICE' ? calcPrice(valorFinanciado, taxa, n) : calcSac(valorFinanciado, taxa, n);
    const valorTotal = valorPrestacao * n;
    const rendaMinimaRequerida = valorPrestacao / 0.3;
    res.json({ valorFinanciado, valorPrestacao, valorTotal, rendaMinimaRequerida });
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const b = req.body ?? {};
    const row = await prisma.simulacoes_financiamento.create({
      data: {
        tenantId: auth.tenantId,
        leadId: b.leadId ?? null,
        preCadastroId: b.preCadastroId ?? null,
        valorImovel: new Prisma.Decimal(b.valorImovel),
        valorEntrada: new Prisma.Decimal(b.valorEntrada),
        prazoMeses: b.prazoMeses,
        taxaJuros: new Prisma.Decimal(b.taxaJuros),
        valorFgts: b.valorFgts != null ? new Prisma.Decimal(b.valorFgts) : null,
        valorSubsidio: b.valorSubsidio != null ? new Prisma.Decimal(b.valorSubsidio) : null,
        sistemaAmortizacao: b.sistemaAmortizacao,
        valorFinanciado: b.valorFinanciado != null ? new Prisma.Decimal(b.valorFinanciado) : null,
        valorPrestacao: b.valorPrestacao != null ? new Prisma.Decimal(b.valorPrestacao) : null,
        valorTotal: b.valorTotal != null ? new Prisma.Decimal(b.valorTotal) : null,
        rendaMinimaRequerida: b.rendaMinimaRequerida != null ? new Prisma.Decimal(b.rendaMinimaRequerida) : null,
      },
    });
    res.status(201).json(row);
  },

  async list(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { leadId, preCadastroId } = req.query as any;
    const rows = await prisma.simulacoes_financiamento.findMany({
      where: { tenantId: auth.tenantId, leadId: leadId || undefined, preCadastroId: preCadastroId || undefined },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  },

  async getById(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { id } = req.params;
    const row = await prisma.simulacoes_financiamento.findFirst({ where: { tenantId: auth.tenantId, id } });
    if (!row) return res.status(404).json({ error: 'Não encontrada' });
    res.json(row);
  },

  async pdf(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { id } = req.params;
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM public.simulacoes_financiamento WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      auth.tenantId, id,
    );
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrada' });
    const s = rows[0];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="simulacao-financiamento.pdf"');
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);
    doc.fontSize(18).text('Simulação de Financiamento', { align: 'center' });
    doc.moveDown();
    const field = (label: string, value: any) => doc.fontSize(12).text(`${label}: ${value ?? '—'}`);
    field('Lead ID', s.lead_id);
    field('Pré‑Cadastro ID', s.pre_cadastro_id);
    field('Valor do Imóvel', `R$ ${Number(s.valor_imovel || 0).toLocaleString('pt-BR')}`);
    field('Entrada', `R$ ${Number(s.valor_entrada || 0).toLocaleString('pt-BR')}`);
    field('Prazo (meses)', s.prazo_meses);
    field('Taxa de Juros (% a.a.)', s.taxa_juros);
    field('FGTS', `R$ ${Number(s.valor_fgts || 0).toLocaleString('pt-BR')}`);
    field('Subsídio', `R$ ${Number(s.valor_subsidio || 0).toLocaleString('pt-BR')}`);
    field('Sistema de Amortização', s.sistema_amortizacao);
    doc.moveDown();
    field('Valor a Financiar', `R$ ${Number(s.valor_financiado || 0).toLocaleString('pt-BR')}`);
    field('Valor da Prestação (1ª/med)', `R$ ${Number(s.valor_prestacao || 0).toLocaleString('pt-BR')}`);
    field('Total a Pagar', `R$ ${Number(s.valor_total || 0).toLocaleString('pt-BR')}`);
    field('Renda Mínima Requerida (30%)', `R$ ${Number(s.renda_minima_requerida || 0).toLocaleString('pt-BR')}`);
    doc.end();
  },
};
