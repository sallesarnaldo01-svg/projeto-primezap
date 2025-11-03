import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';
import { createClient } from '@supabase/supabase-js';
import archiver from 'archiver';
import { PDFDocument } from 'pdf-lib';
import type { JWTPayload } from '@primeflow/shared/types';

type AuthenticatedRequest = Request & { user?: JWTPayload };

function ensureAuth(req: AuthenticatedRequest, res: Response) {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return null; }
  return { tenantId: req.user.tenantId };
}

export const documentosController = {
  // Tipos de documento (config)
  async listTipos(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, nome, etapa, obrigatorio FROM public.documento_tipos WHERE tenant_id = $1 ORDER BY nome`,
        auth.tenantId,
      );
      res.json(rows.map(r => ({ id: r.id, nome: r.nome, etapa: r.etapa, obrigatorio: r.obrigatorio })));
    } catch {
      res.json([]);
    }
  },
  async createTipo(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const b = req.body ?? {};
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `INSERT INTO public.documento_tipos (tenant_id, nome, etapa, obrigatorio) VALUES ($1,$2,$3,$4) RETURNING *`,
        auth.tenantId, b.nome, b.etapa, b.obrigatorio ?? true,
      );
      res.status(201).json(rows[0]);
    } catch {
      res.status(501).json({ error: 'Tabela não disponível' });
    }
  },
  async deleteTipo(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { id } = req.params;
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM public.documento_tipos WHERE tenant_id = $1 AND id = $2`, auth.tenantId, id);
      res.status(204).end();
    } catch {
      res.status(501).json({ error: 'Tabela não disponível' });
    }
  },

  // Documentos
  async list(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { preCadastroId, leadId, dealId } = req.query as any;
    const rows = await prisma.documentos_pre_cadastro.findMany({
      where: {
        tenantId: (auth as any).tenantId,
        preCadastroId: preCadastroId || undefined,
        leadId: leadId || undefined,
        dealId: dealId || undefined,
      },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true, preCadastroId: true, leadId: true, dealId: true, tipo: true, pessoa: true, status: true, url: true, uploadedAt: true },
    });
    res.json(rows);
  },

  async uploadUrl(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { preCadastroId, leadId, dealId, filename } = (req.body ?? {}) as { preCadastroId?: string; leadId?: string; dealId?: string; filename?: string };
    const bucket = 'documents';
    const folder = preCadastroId ? `pre-cadastros/${preCadastroId}` : leadId ? `leads/${leadId}` : dealId ? `deals/${dealId}` : `misc`;
    const path = `${folder}/${Date.now()}-${(filename || 'upload').replace(/\s+/g, '-')}`;

    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data, error } = await supa.storage.from(bucket).createSignedUploadUrl(path);
      if (error || !data) {
        return res.status(500).json({ error: 'Falha ao gerar URL assinada' });
      }
      return res.json({ uploadUrl: data.signedUrl, path: `${bucket}/${path}` });
    }

    // Fallback sem URL assinada (frontend usará Supabase diretamente)
    return res.json({ uploadUrl: '', path: `${bucket}/${path}` });
  },

  async commit(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { path, preCadastroId, leadId, dealId, tipo, pessoa } = (req.body ?? {}) as any;
    try {
      await prisma.documentos_pre_cadastro.create({
        data: {
          tenantId: (auth as any).tenantId,
          preCadastroId: preCadastroId ?? null,
          leadId: leadId ?? null,
          dealId: dealId ?? null,
          tipo: tipo ?? null,
          pessoa: pessoa ?? null,
          status: 'AGUARDANDO_APROVACAO',
          url: path,
        },
      });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Falha ao registrar documento' });
    }
  },

  async approve(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { id } = req.params;
    try {
      await prisma.documentos_pre_cadastro.updateMany({ where: { tenantId: auth.tenantId, id }, data: { status: 'APROVADO' } });
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.notifications (tenant_id, type, data) VALUES ($1,$2,$3)`,
        auth.tenantId, 'DOCUMENT_APPROVED', JSON.stringify({ id }),
      );
    } catch {}
    res.json({ success: true });
  },

  async reject(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { id } = req.params;
    try {
      await prisma.documentos_pre_cadastro.updateMany({ where: { tenantId: auth.tenantId, id }, data: { status: 'REJEITADO' } });
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.notifications (tenant_id, type, data) VALUES ($1,$2,$3)`,
        auth.tenantId, 'DOCUMENT_REJECTED', JSON.stringify({ id }),
      );
    } catch {}
    res.json({ success: true });
  },

  async downloadZip(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { preCadastroId, leadId, dealId } = req.query as any;
    let idx = 2; const params: any[] = [(auth as any).tenantId]; const conds: string[] = [];
    if (preCadastroId) { conds.push(`AND pre_cadastro_id = $${idx++}`); params.push(preCadastroId); }
    if (leadId) { conds.push(`AND lead_id = $${idx++}`); params.push(leadId); }
    if (dealId) { conds.push(`AND deal_id = $${idx++}`); params.push(dealId); }
    const sql = `SELECT url, tipo, pessoa, uploaded_at FROM public.documentos_pre_cadastro WHERE tenant_id = $1 ${conds.join(' ')} ORDER BY uploaded_at DESC`;
    const rows = await prisma.$queryRawUnsafe<any[]>(sql, ...params);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="documentos.zip"');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => { res.status(500).end(String(err)); });
    archive.pipe(res);

    const bucketPath = (p: string) => p.startsWith('documents/') ? p : p.replace(/^.*?\/(documents\/)/, '$1');

    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      for (const r of rows) {
        const path = bucketPath(r.url).replace(/^documents\//, '');
        const { data } = await supa.storage.from('documents').createSignedUrl(path, 60);
        if (data?.signedUrl) {
          const resp = await fetch(data.signedUrl);
          if (resp.ok) {
            const buf = Buffer.from(await resp.arrayBuffer());
            const name = `${(r.tipo || 'doc')}${r.pessoa ? '_' + r.pessoa : ''}_${new Date(r.uploaded_at).toISOString().slice(0,10)}_${path.split('/').pop()}`;
            archive.append(buf, { name });
          }
        }
      }
      await archive.finalize();
      return;
    }

    // Sem Supabase: nada a baixar
    await archive.finalize();
  },

  async downloadPdf(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuth(req, res); if (!auth) return;
    const { preCadastroId, leadId, dealId } = req.query as any;
    let idx = 2; const params: any[] = [(auth as any).tenantId]; const conds: string[] = [];
    if (preCadastroId) { conds.push(`AND pre_cadastro_id = $${idx++}`); params.push(preCadastroId); }
    if (leadId) { conds.push(`AND lead_id = $${idx++}`); params.push(leadId); }
    if (dealId) { conds.push(`AND deal_id = $${idx++}`); params.push(dealId); }
    const sql = `SELECT url, tipo, pessoa, uploaded_at FROM public.documentos_pre_cadastro WHERE tenant_id = $1 ${conds.join(' ')} ORDER BY uploaded_at ASC`;
    const rows = await prisma.$queryRawUnsafe<any[]>(sql, ...params);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documentos.pdf"');
    const mergedPdf = await PDFDocument.create();

    const bucketPath = (p: string) => p.startsWith('documents/') ? p.replace(/^documents\//,'') : p.replace(/^.*?\/(documents\/)*/,'');
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      for (const r of rows) {
        const path = bucketPath(r.url);
        const { data } = await supa.storage.from('documents').createSignedUrl(path, 60);
        if (!data?.signedUrl) continue;
        const resp = await fetch(data.signedUrl);
        if (!resp.ok) continue;
        const contentType = resp.headers.get('content-type') || '';
        const buf = await resp.arrayBuffer();
        try {
          if (contentType.includes('pdf')) {
            const srcPdf = await PDFDocument.load(buf);
            const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
            copiedPages.forEach((p) => mergedPdf.addPage(p));
          } else if (contentType.includes('png') || contentType.includes('jpeg') || contentType.includes('jpg')) {
            let img;
            if (contentType.includes('png')) img = await mergedPdf.embedPng(buf);
            else img = await mergedPdf.embedJpg(buf);
            const page = mergedPdf.addPage();
            const { width, height } = img.size();
            const pageWidth = page.getWidth();
            const pageHeight = page.getHeight();
            const scale = Math.min(pageWidth / width, pageHeight / height) * 0.95;
            const imgWidth = width * scale;
            const imgHeight = height * scale;
            page.drawImage(img, { x: (pageWidth - imgWidth) / 2, y: (pageHeight - imgHeight) / 2, width: imgWidth, height: imgHeight });
          }
        } catch (_) {
          // ignora documentos não suportados
        }
      }
      const pdfBytes = await mergedPdf.save();
      return res.status(200).send(Buffer.from(pdfBytes));
    }
    return res.status(200).send(Buffer.from(await mergedPdf.save()));
  },
};
