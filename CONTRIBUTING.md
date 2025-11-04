# 🤝 Guia de Contribuição

Obrigado por considerar contribuir com o PrimeZap AI! Este documento fornece diretrizes para contribuir com o projeto.

## 📋 Índice

- [Código de Conduta](#código-de-conduta)
- [Como Posso Contribuir?](#como-posso-contribuir)
- [Padrões de Código](#padrões-de-código)
- [Processo de Pull Request](#processo-de-pull-request)
- [Reportando Bugs](#reportando-bugs)
- [Sugerindo Melhorias](#sugerindo-melhorias)

---

## Código de Conduta

Este projeto segue o [Contributor Covenant](https://www.contributor-covenant.org/). Ao participar, você concorda em seguir este código.

### Nossos Compromissos

- Usar linguagem acolhedora e inclusiva
- Respeitar pontos de vista e experiências diferentes
- Aceitar críticas construtivas com elegância
- Focar no que é melhor para a comunidade
- Mostrar empatia com outros membros da comunidade

---

## Como Posso Contribuir?

### 1. Reportando Bugs

Antes de criar um bug report, verifique se o problema já não foi reportado em [Issues](https://github.com/sallesarnaldo01-svg/projeto-primezap/issues).

**Bom Bug Report inclui:**
- Título claro e descritivo
- Passos para reproduzir o problema
- Comportamento esperado vs. comportamento atual
- Screenshots (se aplicável)
- Versão do sistema operacional e navegador
- Logs de erro relevantes

**Template:**
```markdown
## Descrição
[Descrição clara do bug]

## Passos para Reproduzir
1. Vá para '...'
2. Clique em '...'
3. Role até '...'
4. Veja o erro

## Comportamento Esperado
[O que deveria acontecer]

## Comportamento Atual
[O que está acontecendo]

## Screenshots
[Se aplicável]

## Ambiente
- OS: [ex: Windows 11]
- Browser: [ex: Chrome 120]
- Versão: [ex: 1.0.0]
```

### 2. Sugerindo Melhorias

Sugestões de melhorias são sempre bem-vindas!

**Boa Sugestão inclui:**
- Título claro e descritivo
- Explicação detalhada da funcionalidade
- Exemplos de uso
- Benefícios para os usuários
- Possíveis implementações

### 3. Contribuindo com Código

#### Setup do Ambiente

```bash
# Fork e clone o repositório
git clone https://github.com/seu-usuario/projeto-primezap.git
cd projeto-primezap

# Instale as dependências
pnpm install

# Configure as variáveis de ambiente
cp .env.example .env

# Execute as migrations
cd apps/api && pnpm prisma migrate dev

# Inicie o projeto
pnpm dev
```

#### Criando uma Branch

```bash
# Crie uma branch a partir da main
git checkout -b feature/nome-da-feature

# Ou para bugs
git checkout -b fix/nome-do-bug
```

#### Fazendo Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Tipos de commit
feat:     Nova funcionalidade
fix:      Correção de bug
docs:     Documentação
style:    Formatação (não afeta código)
refactor: Refatoração
test:     Testes
chore:    Manutenção

# Exemplos
git commit -m "feat: adiciona autenticação com Google"
git commit -m "fix: corrige erro no envio de mensagens"
git commit -m "docs: atualiza README com novas instruções"
```

---

## Padrões de Código

### TypeScript

```typescript
// ✅ Bom
interface User {
  id: string;
  name: string;
  email: string;
}

function getUser(id: string): Promise<User> {
  // ...
}

// ❌ Ruim
function getUser(id: any): any {
  // ...
}
```

### React

```typescript
// ✅ Bom - Functional component com TypeScript
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// ❌ Ruim - Sem tipos
export function Button({ label, onClick, variant }) {
  // ...
}
```

### Naming Conventions

```typescript
// Componentes: PascalCase
export function UserProfile() {}

// Funções: camelCase
function getUserById(id: string) {}

// Constantes: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;

// Interfaces: PascalCase com I prefix (opcional)
interface IUserData {}
// ou
interface UserData {}

// Types: PascalCase
type UserId = string;

// Enums: PascalCase
enum UserRole {
  Admin = 'admin',
  User = 'user',
}
```

### Estrutura de Arquivos

```
src/
├── components/
│   ├── Button/
│   │   ├── Button.tsx          # Componente
│   │   ├── Button.test.tsx     # Testes
│   │   ├── Button.stories.tsx  # Storybook (opcional)
│   │   └── index.ts            # Export
│   └── index.ts
├── hooks/
│   ├── useAuth.ts
│   └── index.ts
├── services/
│   ├── api.ts
│   └── index.ts
└── types/
    ├── user.ts
    └── index.ts
```

### Testes

```typescript
// ✅ Bom - Testes descritivos
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a new user with valid data', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const user = await userService.createUser(userData);

      expect(user).toHaveProperty('id');
      expect(user.name).toBe(userData.name);
      expect(user.email).toBe(userData.email);
    });

    it('should throw error when email is invalid', async () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email',
      };

      await expect(userService.createUser(userData)).rejects.toThrow(
        'Invalid email'
      );
    });
  });
});
```

### Comentários

```typescript
// ✅ Bom - Comentários úteis
/**
 * Sends a message to a conversation
 * 
 * @param conversationId - The conversation ID
 * @param content - The message content
 * @returns The created message
 * @throws {NotFoundError} If conversation doesn't exist
 * @throws {ValidationError} If content is empty
 */
async function sendMessage(
  conversationId: string,
  content: string
): Promise<Message> {
  // Validate content length
  if (content.length > 4096) {
    throw new ValidationError('Message too long');
  }

  // Send message
  return await messageService.send(conversationId, content);
}

// ❌ Ruim - Comentários óbvios
// Get user by ID
function getUserById(id: string) {
  // Return user
  return users.find(u => u.id === id);
}
```

---

## Processo de Pull Request

### Antes de Submeter

- [ ] Código segue os padrões do projeto
- [ ] Testes passam (`pnpm test`)
- [ ] Lint passa (`pnpm lint`)
- [ ] TypeCheck passa (`pnpm typecheck`)
- [ ] Documentação atualizada (se necessário)
- [ ] Commits seguem Conventional Commits
- [ ] Branch está atualizada com `main`

### Submetendo o PR

1. **Push sua branch**
```bash
git push origin feature/nome-da-feature
```

2. **Abra o Pull Request**
   - Vá para o repositório no GitHub
   - Clique em "New Pull Request"
   - Selecione sua branch
   - Preencha o template

3. **Template do PR**
```markdown
## Descrição
[Descrição clara das mudanças]

## Tipo de Mudança
- [ ] Bug fix (mudança que corrige um problema)
- [ ] Nova funcionalidade (mudança que adiciona funcionalidade)
- [ ] Breaking change (mudança que quebra compatibilidade)
- [ ] Documentação

## Como Testar
1. [Passo 1]
2. [Passo 2]
3. [Passo 3]

## Checklist
- [ ] Código segue os padrões do projeto
- [ ] Testes adicionados/atualizados
- [ ] Documentação atualizada
- [ ] Sem warnings no console
- [ ] Testado em múltiplos navegadores

## Screenshots (se aplicável)
[Screenshots]

## Issues Relacionadas
Closes #123
```

### Code Review

Todos os PRs passam por code review. Espere:
- Feedback construtivo
- Sugestões de melhorias
- Possíveis pedidos de mudanças

**Como responder a feedback:**
- Seja receptivo e profissional
- Faça perguntas se não entender
- Implemente as mudanças solicitadas
- Marque conversas como resolvidas

### Merge

Após aprovação:
- Squash commits (se necessário)
- Merge para `main`
- Delete a branch

---

## Reportando Bugs

### Bugs de Segurança

**NÃO** abra issues públicas para bugs de segurança.

Envie para: [security@primezap.com](mailto:security@primezap.com)

Incluindo:
- Descrição do problema
- Passos para reproduzir
- Impacto potencial
- Sugestões de correção (se tiver)

### Bugs Normais

Abra uma issue em [GitHub Issues](https://github.com/sallesarnaldo01-svg/projeto-primezap/issues) usando o template de bug.

---

## Sugerindo Melhorias

### Feature Requests

Abra uma issue com o label `enhancement`:

```markdown
## Problema
[Qual problema essa feature resolve?]

## Solução Proposta
[Como você imagina que isso funcione?]

## Alternativas Consideradas
[Outras formas de resolver o problema]

## Contexto Adicional
[Screenshots, exemplos, etc.]
```

### Melhorias de Performance

Se encontrou um gargalo de performance:

```markdown
## Problema de Performance
[Descrição do problema]

## Medições
- Tempo atual: [ex: 2s]
- Tempo esperado: [ex: 500ms]
- Profiling: [anexar screenshots]

## Causa Raiz
[Se identificada]

## Solução Proposta
[Como melhorar]
```

---

## Recursos Úteis

- [Documentação do Projeto](docs/)
- [API Documentation](http://localhost:4000/api/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [Fastify Documentation](https://www.fastify.io/docs/)
- [Prisma Documentation](https://www.prisma.io/docs/)

---

## Dúvidas?

- **Discord**: [PrimeZap Community](#)
- **Email**: [dev@primezap.com](mailto:dev@primezap.com)
- **GitHub Discussions**: [Discussions](https://github.com/sallesarnaldo01-svg/projeto-primezap/discussions)

---

## Agradecimentos

Obrigado por contribuir com o PrimeZap AI! 🎉

Toda contribuição, grande ou pequena, é valorizada e apreciada.

---

<div align="center">

**Feito com ❤️ pela comunidade PrimeZap AI**

</div>
