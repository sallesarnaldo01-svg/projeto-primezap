import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createPrompt,
  getPrompt,
  updatePrompt,
  deletePrompt,
  listPrompts,
  duplicatePrompt,
  togglePromptActive,
} from '../../src/services/prompt.service';
import { prisma } from '../../src/lib/prisma';

describe('Prompt Service', () => {
  let testTenantId: string;
  let testPromptId: string;

  beforeAll(async () => {
    testTenantId = `test-tenant-prompts-${Date.now()}`;

    // Criar prompt de teste
    const prompt = await prisma.ai_agents.create({
      data: {
        name: 'Test Prompt',
        systemPrompt: 'You are a helpful assistant',
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
        active: true,
        tenantId: testTenantId,
      },
    });
    testPromptId = prompt.id;
  });

  afterAll(async () => {
    // Limpar dados de teste
    await prisma.ai_agents.deleteMany({
      where: { tenantId: testTenantId },
    });
  });

  describe('createPrompt', () => {
    it('deve criar prompt com sucesso', async () => {
      const promptData = {
        name: 'Sales Assistant',
        systemPrompt: 'You are a sales assistant specialized in real estate',
        provider: 'openai' as const,
        model: 'gpt-4',
        temperature: 0.8,
        maxTokens: 2000,
        tenantId: testTenantId,
      };

      const result = await createPrompt(promptData);

      expect(result).toBeDefined();
      expect(result.name).toBe('Sales Assistant');
      expect(result.systemPrompt).toBe('You are a sales assistant specialized in real estate');
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4');
      expect(result.temperature).toBe(0.8);
      expect(result.maxTokens).toBe(2000);
      expect(result.active).toBe(true); // Padrão

      // Limpar
      await prisma.ai_agents.delete({ where: { id: result.id } });
    });

    it('deve criar prompt com valores padrão', async () => {
      const promptData = {
        name: 'Simple Prompt',
        systemPrompt: 'Simple system prompt',
        provider: 'openai' as const,
        tenantId: testTenantId,
      };

      const result = await createPrompt(promptData);

      expect(result.model).toBeDefined();
      expect(result.temperature).toBeDefined();
      expect(result.maxTokens).toBeDefined();
      expect(result.active).toBe(true);

      await prisma.ai_agents.delete({ where: { id: result.id } });
    });

    it('deve criar prompt inativo', async () => {
      const promptData = {
        name: 'Inactive Prompt',
        systemPrompt: 'Test',
        provider: 'openai' as const,
        active: false,
        tenantId: testTenantId,
      };

      const result = await createPrompt(promptData);

      expect(result.active).toBe(false);

      await prisma.ai_agents.delete({ where: { id: result.id } });
    });

    it('deve validar campos obrigatórios', async () => {
      // @ts-expect-error - Testando validação
      await expect(createPrompt({})).rejects.toThrow();
    });
  });

  describe('getPrompt', () => {
    it('deve buscar prompt por ID', async () => {
      const result = await getPrompt(testPromptId);

      expect(result).toBeDefined();
      expect(result.id).toBe(testPromptId);
      expect(result.name).toBe('Test Prompt');
      expect(result.systemPrompt).toBe('You are a helpful assistant');
    });

    it('deve retornar null quando prompt não existe', async () => {
      const result = await getPrompt('invalid-uuid-123');

      expect(result).toBeNull();
    });
  });

  describe('updatePrompt', () => {
    it('deve atualizar nome do prompt', async () => {
      const result = await updatePrompt(testPromptId, {
        name: 'Updated Test Prompt',
      });

      expect(result.name).toBe('Updated Test Prompt');
      expect(result.systemPrompt).toBe('You are a helpful assistant'); // Não mudou
    });

    it('deve atualizar systemPrompt', async () => {
      const result = await updatePrompt(testPromptId, {
        systemPrompt: 'You are an updated assistant',
      });

      expect(result.systemPrompt).toBe('You are an updated assistant');
    });

    it('deve atualizar temperatura', async () => {
      const result = await updatePrompt(testPromptId, {
        temperature: 0.5,
      });

      expect(result.temperature).toBe(0.5);
    });

    it('deve atualizar maxTokens', async () => {
      const result = await updatePrompt(testPromptId, {
        maxTokens: 1500,
      });

      expect(result.maxTokens).toBe(1500);
    });

    it('deve atualizar múltiplos campos', async () => {
      const result = await updatePrompt(testPromptId, {
        name: 'Multi Update',
        temperature: 0.9,
        maxTokens: 3000,
      });

      expect(result.name).toBe('Multi Update');
      expect(result.temperature).toBe(0.9);
      expect(result.maxTokens).toBe(3000);
    });

    it('deve lançar erro quando prompt não existe', async () => {
      await expect(
        updatePrompt('invalid-uuid-456', { name: 'Test' })
      ).rejects.toThrow();
    });
  });

  describe('deletePrompt', () => {
    it('deve deletar prompt com sucesso', async () => {
      // Criar prompt temporário
      const tempPrompt = await prisma.ai_agents.create({
        data: {
          name: 'To Delete',
          systemPrompt: 'Test',
          provider: 'openai',
          tenantId: testTenantId,
        },
      });

      await deletePrompt(tempPrompt.id);

      const result = await prisma.ai_agents.findUnique({
        where: { id: tempPrompt.id },
      });

      expect(result).toBeNull();
    });

    it('deve lançar erro quando prompt não existe', async () => {
      await expect(deletePrompt('invalid-uuid-789')).rejects.toThrow();
    });
  });

  describe('listPrompts', () => {
    beforeAll(async () => {
      // Criar alguns prompts adicionais para teste de listagem
      await prisma.ai_agents.createMany({
        data: [
          {
            name: 'Active Prompt 1',
            systemPrompt: 'Test 1',
            provider: 'openai',
            active: true,
            tenantId: testTenantId,
          },
          {
            name: 'Active Prompt 2',
            systemPrompt: 'Test 2',
            provider: 'anthropic',
            active: true,
            tenantId: testTenantId,
          },
          {
            name: 'Inactive Prompt',
            systemPrompt: 'Test 3',
            provider: 'openai',
            active: false,
            tenantId: testTenantId,
          },
        ],
      });
    });

    it('deve listar todos os prompts do tenant', async () => {
      const result = await listPrompts({ tenantId: testTenantId });

      expect(result.length).toBeGreaterThanOrEqual(4);
    });

    it('deve filtrar por active=true', async () => {
      const result = await listPrompts({
        tenantId: testTenantId,
        active: true,
      });

      expect(result.every(p => p.active)).toBe(true);
    });

    it('deve filtrar por active=false', async () => {
      const result = await listPrompts({
        tenantId: testTenantId,
        active: false,
      });

      expect(result.every(p => !p.active)).toBe(true);
    });

    it('deve filtrar por provider', async () => {
      const result = await listPrompts({
        tenantId: testTenantId,
        provider: 'openai',
      });

      expect(result.every(p => p.provider === 'openai')).toBe(true);
    });

    it('deve buscar por nome', async () => {
      const result = await listPrompts({
        tenantId: testTenantId,
        search: 'Active',
      });

      expect(result.every(p => p.name.includes('Active'))).toBe(true);
    });

    it('deve buscar por systemPrompt', async () => {
      const result = await listPrompts({
        tenantId: testTenantId,
        search: 'helpful',
      });

      expect(result.length).toBeGreaterThan(0);
      expect(
        result.some(p => p.systemPrompt.includes('helpful'))
      ).toBe(true);
    });

    it('deve paginar resultados', async () => {
      const page1 = await listPrompts({
        tenantId: testTenantId,
        limit: 2,
        offset: 0,
      });

      const page2 = await listPrompts({
        tenantId: testTenantId,
        limit: 2,
        offset: 2,
      });

      expect(page1.length).toBeLessThanOrEqual(2);
      expect(page2.length).toBeLessThanOrEqual(2);
      expect(page1[0].id).not.toBe(page2[0]?.id);
    });

    it('deve ordenar por createdAt desc por padrão', async () => {
      const result = await listPrompts({ tenantId: testTenantId });

      for (let i = 0; i < result.length - 1; i++) {
        const current = new Date(result[i].createdAt).getTime();
        const next = new Date(result[i + 1].createdAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it('deve retornar array vazio quando não há prompts', async () => {
      const result = await listPrompts({ tenantId: 'non-existent-tenant' });

      expect(result).toEqual([]);
    });
  });

  describe('duplicatePrompt', () => {
    it('deve duplicar prompt com sucesso', async () => {
      const duplicate = await duplicatePrompt(testPromptId);

      expect(duplicate.id).not.toBe(testPromptId);
      expect(duplicate.name).toContain('Test Prompt');
      expect(duplicate.name).toContain('(Copy)');
      expect(duplicate.systemPrompt).toBe('You are a helpful assistant');
      expect(duplicate.provider).toBe('openai');
      expect(duplicate.model).toBe('gpt-4');

      // Limpar
      await prisma.ai_agents.delete({ where: { id: duplicate.id } });
    });

    it('deve criar cópia inativa', async () => {
      const duplicate = await duplicatePrompt(testPromptId);

      expect(duplicate.active).toBe(false);

      await prisma.ai_agents.delete({ where: { id: duplicate.id } });
    });

    it('deve lançar erro quando prompt não existe', async () => {
      await expect(duplicatePrompt('invalid-uuid-abc')).rejects.toThrow();
    });
  });

  describe('togglePromptActive', () => {
    it('deve ativar prompt inativo', async () => {
      // Criar prompt inativo
      const inactivePrompt = await prisma.ai_agents.create({
        data: {
          name: 'Inactive',
          systemPrompt: 'Test',
          provider: 'openai',
          active: false,
          tenantId: testTenantId,
        },
      });

      const result = await togglePromptActive(inactivePrompt.id);

      expect(result.active).toBe(true);

      await prisma.ai_agents.delete({ where: { id: inactivePrompt.id } });
    });

    it('deve desativar prompt ativo', async () => {
      const result = await togglePromptActive(testPromptId);

      expect(result.active).toBe(false);

      // Restaurar
      await prisma.ai_agents.update({
        where: { id: testPromptId },
        data: { active: true },
      });
    });

    it('deve alternar múltiplas vezes', async () => {
      const toggle1 = await togglePromptActive(testPromptId);
      expect(toggle1.active).toBe(false);

      const toggle2 = await togglePromptActive(testPromptId);
      expect(toggle2.active).toBe(true);
    });

    it('deve lançar erro quando prompt não existe', async () => {
      await expect(togglePromptActive('invalid-uuid-def')).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('deve lidar com systemPrompt muito longo', async () => {
      const longPrompt = 'a'.repeat(10000);

      const result = await createPrompt({
        name: 'Long Prompt',
        systemPrompt: longPrompt,
        provider: 'openai',
        tenantId: testTenantId,
      });

      expect(result.systemPrompt.length).toBe(10000);

      await prisma.ai_agents.delete({ where: { id: result.id } });
    });

    it('deve lidar com caracteres especiais no nome', async () => {
      const result = await createPrompt({
        name: 'Prompt with émojis 🚀 and spëcial çhars',
        systemPrompt: 'Test',
        provider: 'openai',
        tenantId: testTenantId,
      });

      expect(result.name).toBe('Prompt with émojis 🚀 and spëcial çhars');

      await prisma.ai_agents.delete({ where: { id: result.id } });
    });

    it('deve lidar com temperatura nos limites', async () => {
      const result = await createPrompt({
        name: 'Temp Test',
        systemPrompt: 'Test',
        provider: 'openai',
        temperature: 0,
        tenantId: testTenantId,
      });

      expect(result.temperature).toBe(0);

      await prisma.ai_agents.delete({ where: { id: result.id } });
    });

    it('deve lidar com maxTokens muito alto', async () => {
      const result = await createPrompt({
        name: 'Max Tokens Test',
        systemPrompt: 'Test',
        provider: 'openai',
        maxTokens: 100000,
        tenantId: testTenantId,
      });

      expect(result.maxTokens).toBe(100000);

      await prisma.ai_agents.delete({ where: { id: result.id } });
    });
  });
});
