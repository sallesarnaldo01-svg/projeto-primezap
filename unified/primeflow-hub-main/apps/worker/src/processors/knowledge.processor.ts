import { Job } from 'bullmq';
import { OpenAI } from 'openai';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { supabase } from '../lib/supabase.js';
import { env } from '../config/env.js';

interface KnowledgeProcessJob {
  tenantId: string;
  documentId: string;
  fileUrl: string;
  type: string;
}

export async function processKnowledgeDocument(job: Job<KnowledgeProcessJob>) {
  const { tenantId, documentId, fileUrl, type } = job.data;

  try {
    logger.info({ documentId, type }, 'Processing knowledge document');

    let extractedText = '';
    let chunkCount = 0;

    switch (type) {
      case 'pdf':
        extractedText = await extractTextFromPdf(fileUrl);
        break;
      case 'docx':
        extractedText = await extractTextFromDocx(fileUrl);
        break;
      case 'txt':
      case 'md':
        extractedText = await extractTextFromPlainFile(fileUrl);
        break;
      default:
        logger.warn({ type }, 'Unsupported document type');
    }

    let embeddingStatus: 'pending' | 'completed' | 'failed' = 'pending';

    if (extractedText.trim().length === 0) {
      logger.warn({ documentId }, 'No text extracted from document');
    } else {
      const chunks = chunkText(extractedText);
      chunkCount = chunks.length;

      if (!chunks.length) {
        logger.warn({ documentId }, 'Text extraction returned empty chunks');
      } else {
        const apiKey = env.OPENAI_API_KEY;

        if (!apiKey) {
          logger.warn('OPENAI_API_KEY not configured. Skipping embedding generation.');
        } else {
          try {
            const openai = new OpenAI({ apiKey });
            const embeddingResponse = await openai.embeddings.create({
              model: 'text-embedding-3-small',
              input: chunks
            });

            const vectors = embeddingResponse.data?.map(item => item.embedding) ?? [];

            if (vectors.length !== chunks.length) {
              logger.warn(
                { documentId, expected: chunks.length, received: vectors.length },
                'Embedding response size mismatch'
              );
            } else {
              await supabase
                .from('knowledge_embeddings')
                .delete()
                .eq('document_id', documentId);

              const rows = chunks.map((chunk, index) => ({
                document_id: documentId,
                chunk_index: index,
                content: chunk,
                embedding: vectors[index],
                metadata: {
                  length: chunk.length
                }
              }));

              const { error: insertError } = await supabase
                .from('knowledge_embeddings')
                .insert(rows);

              if (insertError) {
                throw insertError;
              }

              embeddingStatus = 'completed';
            }
          } catch (error) {
            embeddingStatus = 'failed';
            logger.error({ error, documentId }, 'Failed to generate embeddings for knowledge document');
          }
        }
      }
    }

    // Atualizar documento com texto extraído e embeddings
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        content: extractedText,
        chunkCount,
        embeddingStatus
      }
    });

    logger.info({ documentId }, 'Knowledge document processed successfully');

    return {
      success: true,
      contentLength: extractedText.length,
      hasEmbeddings: embeddingStatus === 'completed'
    };
  } catch (error) {
    logger.error({ error, documentId }, 'Failed to process knowledge document');
    throw error;
  }
}

async function extractTextFromPdf(fileUrl: string): Promise<string> {
  if (!fileUrl) return '';

  try {
    const buffer = await downloadFile(fileUrl);
    const pdfModule = await import('pdf-parse');
    const pdfParse = (pdfModule.default ?? pdfModule) as (data: Buffer) => Promise<{ text: string }>;
    const result = await pdfParse(buffer);
    return result.text ?? '';
  } catch (error) {
    logger.error({ error, fileUrl }, 'Failed to extract text from PDF');
    return '';
  }
}

async function extractTextFromDocx(fileUrl: string): Promise<string> {
  if (!fileUrl) return '';

  try {
    const buffer = await downloadFile(fileUrl);
    const mammothModule = await import('mammoth');
    const extractor = (mammothModule as any).extractRawText ?? mammothModule.default?.extractRawText;
    if (typeof extractor !== 'function') {
      throw new Error('mammoth.extractRawText is not available');
    }
    const result = await extractor({ buffer });
    return result.value ?? '';
  } catch (error) {
    logger.error({ error, fileUrl }, 'Failed to extract text from DOCX');
    return '';
  }
}

async function extractTextFromPlainFile(fileUrl: string): Promise<string> {
  if (!fileUrl) return '';

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    logger.error({ error, fileUrl }, 'Failed to extract text from plain file');
    return '';
  }
}

async function downloadFile(fileUrl: string): Promise<Buffer> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function chunkText(text: string, chunkSize = 1500): string[] {
  if (!text) return [];

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= chunkSize) {
    return [normalized];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    chunks.push(normalized.slice(start, end));
    start = end;
  }

  return chunks;
}
