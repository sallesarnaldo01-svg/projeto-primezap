import { beforeAll, afterAll } from 'vitest';
import { config } from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente de teste
config({ path: path.resolve(__dirname, '../.env.test') });

// Configurar timeout global
beforeAll(async () => {
  console.log('🧪 Iniciando testes de integração...');
  
  // Aguardar serviços estarem prontos
  await new Promise((resolve) => setTimeout(resolve, 1000));
});

afterAll(async () => {
  console.log('✅ Testes concluídos');
});
