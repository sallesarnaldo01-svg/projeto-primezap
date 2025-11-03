# 🚀 Patch 2: Contatos e Deals
## Primeflow-Hub - CRUD Completo de CRM

**Versão**: 1.0.0  
**Data**: 12/10/2025  
**Prioridade**: 🔴 CRÍTICA  
**Tempo Estimado**: 10-14 horas  
**Dependências**: Patch 1

---

## 📊 O Que Este Patch Faz

Este é o **segundo patch crítico** que implementa o coração do CRM:

1. ✅ **CRUD completo de Contatos** (frontend + backend)
2. ✅ **CRUD completo de Deals** (frontend + backend)
3. ✅ **Importação CSV** de contatos
4. ✅ **Drag-and-drop** no Kanban salvando no banco
5. ✅ **Timeline de atividades** por contato
6. ✅ **Estatísticas** de contatos e deals
7. ✅ **Bulk AI Dialog** (preparado para IA)

**Resultado**: CRM 100% funcional com persistência no banco

---

## 📦 Conteúdo do Patch

### Frontend (2 services)

| Arquivo | Linhas | Função |
|---------|--------|--------|
| **contacts.service.ts** | 280 | Service completo de contatos |
| **deals.service.ts** | 290 | Service completo de deals |

### Backend (2 controllers)

| Arquivo | Linhas | Função |
|---------|--------|--------|
| **contacts.controller.ts** | 380 | API de contatos |
| **deals.controller.ts** | 420 | API de deals |

### Endpoints Implementados

#### Contatos (9 endpoints)
- `GET /api/contacts` - Listar com filtros
- `GET /api/contacts/:id` - Buscar por ID
- `POST /api/contacts` - Criar
- `PUT /api/contacts/:id` - Atualizar
- `DELETE /api/contacts/:id` - Deletar
- `POST /api/contacts/import` - Importar CSV
- `GET /api/contacts/:id/timeline` - Timeline
- `GET /api/contacts/stats` - Estatísticas

#### Deals (10 endpoints)
- `GET /api/deals` - Listar com filtros
- `GET /api/deals/by-stage` - Agrupar por estágio (Kanban)
- `GET /api/deals/:id` - Buscar por ID
- `POST /api/deals` - Criar
- `PUT /api/deals/:id` - Atualizar
- `PATCH /api/deals/:id/stage` - Atualizar estágio (drag-and-drop)
- `DELETE /api/deals/:id` - Deletar
- `POST /api/deals/bulk-ai` - Ação de IA em massa
- `GET /api/deals/stats` - Estatísticas
- `GET /api/deals/:id/history` - Histórico

---

## 🚀 Instalação Rápida (10 minutos)

### Método 1: Automático (Recomendado)

```bash
# 1. Extrair patch
cd /home/administrator
tar -xzf patch2_contatos_deals.tar.gz
cd patch2_contatos_deals

# 2. Executar instalação
sudo bash scripts/install.sh /home/administrator/unified/primeflow-hub-main

# 3. Testar
cd /home/administrator/unified/primeflow-hub-main
pnpm dev
```

---

## 📋 Instalação Manual (Passo a Passo)

### Passo 1: Copiar Services Frontend (2 min)

```bash
PROJECT="/home/administrator/unified/primeflow-hub-main"

# Criar diretório se não existir
mkdir -p $PROJECT/src/services

# Copiar services
cp frontend/services/contacts.service.ts $PROJECT/src/services/
cp frontend/services/deals.service.ts $PROJECT/src/services/
```

### Passo 2: Copiar Controllers Backend (2 min)

```bash
# Criar diretório se não existir
mkdir -p $PROJECT/apps/api/src/controllers

# Copiar controllers
cp backend/controllers/contacts.controller.ts $PROJECT/apps/api/src/controllers/
cp backend/controllers/deals.controller.ts $PROJECT/apps/api/src/controllers/
```

### Passo 3: Adicionar Rotas no Backend (5 min)

Editar `$PROJECT/apps/api/src/index.ts`:

```typescript
// Importar controllers
import { contactsController } from './controllers/contacts.controller.js';
import { dealsController } from './controllers/deals.controller.js';
import multer from 'multer';

// Configurar multer para upload
const upload = multer({ storage: multer.memoryStorage() });

// Rotas de Contatos
app.get('/api/contacts', authMiddleware, contactsController.listContacts);
app.get('/api/contacts/stats', authMiddleware, contactsController.getStats);
app.get('/api/contacts/:id', authMiddleware, contactsController.getContact);
app.post('/api/contacts', authMiddleware, contactsController.createContact);
app.put('/api/contacts/:id', authMiddleware, contactsController.updateContact);
app.delete('/api/contacts/:id', authMiddleware, contactsController.deleteContact);
app.post('/api/contacts/import', authMiddleware, upload.single('file'), contactsController.importCSV);
app.get('/api/contacts/:id/timeline', authMiddleware, contactsController.getTimeline);

// Rotas de Deals
app.get('/api/deals', authMiddleware, dealsController.listDeals);
app.get('/api/deals/by-stage', authMiddleware, dealsController.getDealsByStage);
app.get('/api/deals/stats', authMiddleware, dealsController.getStats);
app.get('/api/deals/:id', authMiddleware, dealsController.getDeal);
app.post('/api/deals', authMiddleware, dealsController.createDeal);
app.put('/api/deals/:id', authMiddleware, dealsController.updateDeal);
app.patch('/api/deals/:id/stage', authMiddleware, dealsController.updateStage);
app.delete('/api/deals/:id', authMiddleware, dealsController.deleteDeal);
app.post('/api/deals/bulk-ai', authMiddleware, dealsController.bulkAIAction);
app.get('/api/deals/:id/history', authMiddleware, dealsController.getHistory);
```

### Passo 4: Instalar Dependências (2 min)

```bash
cd $PROJECT/apps/api
pnpm add papaparse zod
pnpm add -D @types/papaparse

cd $PROJECT
pnpm add papaparse
```

### Passo 5: Atualizar Página Contatos (3-4 horas)

Editar `$PROJECT/src/pages/Contatos.tsx`:

```typescript
// REMOVER imports de Supabase direto
// import { supabase } from '@/lib/supabase';

// ADICIONAR
import { contactsService } from '@/services/contacts.service';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Hook customizado
function useContacts(filters) {
  return useQuery({
    queryKey: ['contacts', filters],
    queryFn: () => contactsService.getContacts(filters),
    refetchInterval: 30000, // Atualizar a cada 30s
  });
}

// No componente
export function Contatos() {
  const [filters, setFilters] = useState({});
  const { data: contacts, isLoading } = useContacts(filters);
  const queryClient = useQueryClient();

  // Mutation de criar
  const createMutation = useMutation({
    mutationFn: contactsService.createContact,
    onSuccess: () => {
      queryClient.invalidateQueries(['contacts']);
      toast.success('Contato criado com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Mutation de atualizar
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => contactsService.updateContact(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries(['contacts']);
      toast.success('Contato atualizado!');
    },
  });

  // Mutation de deletar
  const deleteMutation = useMutation({
    mutationFn: contactsService.deleteContact,
    onSuccess: () => {
      queryClient.invalidateQueries(['contacts']);
      toast.success('Contato deletado!');
    },
  });

  // Handler de importação CSV
  const handleImportCSV = async (file) => {
    try {
      const result = await contactsService.importCSV(file);
      toast.success(`${result.imported} contatos importados!`);
      queryClient.invalidateQueries(['contacts']);
    } catch (error) {
      toast.error(`Erro ao importar: ${error.message}`);
    }
  };

  // Render
  return (
    <div>
      {/* Filtros */}
      <input 
        placeholder="Buscar..." 
        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
      />
      
      {/* Lista de contatos */}
      {isLoading ? (
        <div>Carregando...</div>
      ) : (
        <table>
          {contacts?.map(contact => (
            <tr key={contact.id}>
              <td>{contact.name}</td>
              <td>{contact.phone}</td>
              <td>
                <button onClick={() => updateMutation.mutate({ id: contact.id, updates: {...} })}>
                  Editar
                </button>
                <button onClick={() => deleteMutation.mutate(contact.id)}>
                  Deletar
                </button>
              </td>
            </tr>
          ))}
        </table>
      )}
    </div>
  );
}
```

### Passo 6: Atualizar Página CRM (3-4 horas)

Editar `$PROJECT/src/pages/CRM.tsx`:

```typescript
import { dealsService } from '@/services/deals.service';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function useDeals() {
  return useQuery({
    queryKey: ['deals-by-stage'],
    queryFn: () => dealsService.getDealsByStage(),
    refetchInterval: 30000,
  });
}

export function CRM() {
  const { data: dealsByStage, isLoading } = useDeals();
  const queryClient = useQueryClient();

  // Mutation para atualizar estágio
  const updateStageMutation = useMutation({
    mutationFn: ({ dealId, newStage }) => 
      dealsService.updateDealStage(dealId, newStage),
    onSuccess: () => {
      queryClient.invalidateQueries(['deals-by-stage']);
      toast.success('Deal movido!');
    },
  });

  // Handler de drag-and-drop
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const dealId = active.id as string;
      const newStage = over.id as string;
      
      updateStageMutation.mutate({ dealId, newStage });
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-4">
        {Object.entries(dealsByStage || {}).map(([stage, deals]) => (
          <div key={stage} className="flex-1">
            <h3>{stage}</h3>
            {deals.map(deal => (
              <div key={deal.id} draggable>
                {deal.title} - R$ {deal.value}
              </div>
            ))}
          </div>
        ))}
      </div>
    </DndContext>
  );
}
```

---

## ✅ Checklist de Validação

### Após Instalação

- [ ] Services copiados para `src/services/`
- [ ] Controllers copiados para `apps/api/src/controllers/`
- [ ] Rotas adicionadas no `index.ts`
- [ ] Dependências instaladas
- [ ] Sem erros de compilação

### Teste de Contatos

- [ ] Listar contatos carrega do banco
- [ ] Criar contato funciona
- [ ] Editar contato funciona
- [ ] Deletar contato funciona
- [ ] Importação CSV funciona
- [ ] Filtros funcionam (busca, tags, origem)
- [ ] Timeline de atividades carrega
- [ ] Estatísticas aparecem

### Teste de Deals

- [ ] Listar deals carrega do banco
- [ ] Kanban mostra deals por estágio
- [ ] Criar deal funciona
- [ ] Editar deal funciona
- [ ] Deletar deal funciona
- [ ] Drag-and-drop salva no banco
- [ ] Histórico de mudanças registra
- [ ] Estatísticas aparecem

---

## 🐛 Troubleshooting

### Erro: "Cannot find module 'papaparse'"

**Solução**:
```bash
cd apps/api && pnpm add papaparse
cd ../.. && pnpm add papaparse
```

### Erro: "contactsService is not defined"

**Solução**: Verificar se service foi copiado e importado corretamente:
```typescript
import { contactsService } from '@/services/contacts.service';
```

### Erro: "Route not found"

**Solução**: Verificar se rotas foram adicionadas no `index.ts` do backend

### Drag-and-drop não salva

**Solução**: Verificar se mutation está sendo chamada:
```typescript
const updateStageMutation = useMutation({
  mutationFn: ({ dealId, newStage }) => dealsService.updateDealStage(dealId, newStage),
  onSuccess: () => {
    queryClient.invalidateQueries(['deals-by-stage']);
  },
});
```

---

## 📊 Progresso do Projeto

### Antes do Patch 2

| Métrica | Valor |
|---------|-------|
| Páginas Conectadas | 23/40 (58%) |
| CRUD Contatos | ❌ Mockado |
| CRUD Deals | ❌ Mockado |
| Status | 70% |

### Depois do Patch 2

| Métrica | Valor |
|---------|-------|
| Páginas Conectadas | 25/40 (63%) |
| CRUD Contatos | ✅ Funcional |
| CRUD Deals | ✅ Funcional |
| Status | 78% |

---

## 🎯 Próximos Passos

Após aplicar este patch:

1. ✅ Validar CRUD de contatos
2. ✅ Validar CRUD de deals
3. ✅ Testar drag-and-drop
4. ✅ Aplicar **Patch 3** (Providers e Webhooks)

---

## 📞 Suporte

Se encontrar problemas:

1. Consultar seção Troubleshooting
2. Verificar logs: `tail -f apps/api/logs/error.log`
3. Reverter backup: `bash scripts/restore-backup.sh`

---

**Patch criado em**: 12/10/2025  
**Última atualização**: 12/10/2025  
**Versão**: 1.0.0  
**Status**: ✅ Pronto para uso

