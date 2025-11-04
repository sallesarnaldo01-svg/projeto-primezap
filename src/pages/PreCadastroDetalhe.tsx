import React from 'react';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';

// Componente de Detalhe de Pré-Cadastro
const PreCadastroDetalhe: React.FC = () => {
  // Simulação de dados de um pré-cadastro
  const cadastro = {
    id: 1,
    nome: 'João da Silva',
    email: 'joao.silva@example.com',
    telefone: '(11) 98765-4321',
    status: 'Pendente',
    data: '2025-11-01',
    imovelInteresse: 'Apartamento 3 Quartos, Centro',
    renda: 'R$ 8.500,00',
    observacoes: 'Cliente busca financiamento de 80% do valor do imóvel.',
  };

  return (
    <Layout title={`Detalhe: ${cadastro.nome}`}>
      <div className="flex justify-between items-center mb-6">
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <h1 className="text-3xl font-bold">Detalhes do Pré-Cadastro</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{cadastro.nome}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p><strong>Status:</strong> <span className={`font-semibold ${cadastro.status === 'Pendente' ? 'text-yellow-600' : 'text-green-600'}`}>{cadastro.status}</span></p>
          <p><strong>Email:</strong> {cadastro.email}</p>
          <p><strong>Telefone:</strong> {cadastro.telefone}</p>
          <p><strong>Data de Envio:</strong> {cadastro.data}</p>
          <p><strong>Imóvel de Interesse:</strong> {cadastro.imovelInteresse}</p>
          <p><strong>Renda Estimada:</strong> {cadastro.renda}</p>
          <p><strong>Observações:</strong> {cadastro.observacoes}</p>

          <div className="pt-4 space-x-4">
            <Button variant="default">Aprovar</Button>
            <Button variant="destructive">Rejeitar</Button>
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
};

export default PreCadastroDetalhe;
