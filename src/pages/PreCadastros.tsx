import React from 'react';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Plus } from 'lucide-react';

// Componente de Listagem de Pré-Cadastros
const PreCadastros: React.FC = () => {
  // Simulação de dados de pré-cadastros
  const preCadastros = [
    { id: 1, nome: 'João da Silva', status: 'Pendente', data: '2025-11-01' },
    { id: 2, nome: 'Maria Souza', status: 'Aprovado', data: '2025-10-28' },
    { id: 3, nome: 'Pedro Santos', status: 'Rejeitado', data: '2025-10-25' },
  ];

  return (
    <Layout title="Pré-Cadastros Imobiliários">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gestão de Pré-Cadastros</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo Pré-Cadastro
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Pré-Cadastros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {preCadastros.map((cadastro) => (
              <div
                key={cadastro.id}
                className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-semibold">{cadastro.nome}</p>
                  <p className="text-sm text-gray-500">Status: {cadastro.status}</p>
                </div>
                <Button variant="outline" onClick={() => window.location.href = `/pre-cadastros/${cadastro.id}`}>
                  Ver Detalhes
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
};

export default PreCadastros;
