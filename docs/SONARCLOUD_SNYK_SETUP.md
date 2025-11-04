# Configuração do SonarCloud e Snyk

Guia completo para configurar análise de qualidade de código (SonarCloud) e segurança (Snyk) no projeto PrimeZap AI.

---

## 📊 SonarCloud

### O Que é SonarCloud?

SonarCloud é uma plataforma de análise de qualidade de código que identifica:
- 🐛 Bugs e code smells
- 🔒 Vulnerabilidades de segurança
- 📊 Cobertura de testes
- 🔄 Duplicação de código
- 📈 Métricas de complexidade

### Configuração Inicial

#### 1. Criar Conta no SonarCloud

1. Acesse [sonarcloud.io](https://sonarcloud.io)
2. Faça login com sua conta do GitHub
3. Autorize o SonarCloud a acessar seus repositórios

#### 2. Importar Projeto

1. Clique em **"+"** → **"Analyze new project"**
2. Selecione o repositório `projeto-primezap`
3. Escolha o plano **Free** (para projetos open source/privados pequenos)
4. Configure a organização:
   - **Organization**: `sallesarnaldo01-svg`
   - **Project Key**: `sallesarnaldo01-svg_projeto-primezap`

#### 3. Configurar Secrets no GitHub

1. Vá para **Settings** → **Secrets and variables** → **Actions**
2. Adicione o secret:
   - **Name**: `SONAR_TOKEN`
   - **Value**: (copie do SonarCloud em **My Account** → **Security**)

#### 4. Executar Primeira Análise

```bash
# Localmente (opcional)
pnpm install -g sonarqube-scanner
sonar-scanner

# Ou aguarde o push para main/develop
git push origin main
```

### Arquivos de Configuração

#### `sonar-project.properties`

Já criado na raiz do projeto com:
- ✅ Identificação do projeto
- ✅ Caminhos de código-fonte e testes
- ✅ Exclusões (node_modules, dist, etc.)
- ✅ Configuração de cobertura
- ✅ Thresholds de qualidade

#### `.github/workflows/sonarcloud.yml`

Workflow do GitHub Actions que:
- ✅ Executa em push/PR para main/develop
- ✅ Instala dependências
- ✅ Roda testes com cobertura
- ✅ Envia resultados para SonarCloud
- ✅ Upload para Codecov (opcional)

### Interpretando Resultados

#### Quality Gate

O Quality Gate define se o código passa nos critérios mínimos:

| Métrica | Threshold | Descrição |
|---------|-----------|-----------|
| **Coverage** | ≥ 80% | Cobertura de testes |
| **Duplications** | ≤ 3% | Código duplicado |
| **Maintainability Rating** | ≤ A | Facilidade de manutenção |
| **Reliability Rating** | ≤ A | Ausência de bugs |
| **Security Rating** | ≤ A | Ausência de vulnerabilidades |

#### Badges

Adicione badges ao README.md:

```markdown
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=sallesarnaldo01-svg_projeto-primezap&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=sallesarnaldo01-svg_projeto-primezap)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=sallesarnaldo01-svg_projeto-primezap&metric=coverage)](https://sonarcloud.io/summary/new_code?id=sallesarnaldo01-svg_projeto-primezap)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=sallesarnaldo01-svg_projeto-primezap&metric=bugs)](https://sonarcloud.io/summary/new_code?id=sallesarnaldo01-svg_projeto-primezap)
```

---

## 🔒 Snyk

### O Que é Snyk?

Snyk é uma plataforma de segurança que identifica:
- 🔓 Vulnerabilidades em dependências
- 🐛 Problemas de segurança no código
- 🐳 Vulnerabilidades em imagens Docker
- 📦 Licenças problemáticas

### Configuração Inicial

#### 1. Criar Conta no Snyk

1. Acesse [snyk.io](https://snyk.io)
2. Faça login com sua conta do GitHub
3. Autorize o Snyk a acessar seus repositórios

#### 2. Importar Projeto

1. Clique em **"Add project"** → **"GitHub"**
2. Selecione o repositório `projeto-primezap`
3. Snyk detectará automaticamente:
   - 📦 `package.json` (dependências Node.js)
   - 🐳 `Dockerfile` (imagens Docker)
   - 🔧 Arquivos de configuração

#### 3. Configurar Secrets no GitHub

1. Vá para **Settings** → **Secrets and variables** → **Actions**
2. Adicione o secret:
   - **Name**: `SNYK_TOKEN`
   - **Value**: (copie do Snyk em **Account Settings** → **API Token**)

#### 4. Executar Primeira Análise

```bash
# Instalar Snyk CLI
npm install -g snyk

# Autenticar
snyk auth

# Testar dependências
snyk test

# Testar código
snyk code test

# Monitorar projeto
snyk monitor
```

### Arquivos de Configuração

#### `.snyk`

Já criado na raiz do projeto com:
- ✅ Políticas de severidade
- ✅ Exclusões (node_modules, tests, etc.)
- ✅ Configurações de linguagem

#### `.github/workflows/snyk.yml`

Workflow do GitHub Actions que:
- ✅ Executa em push/PR para main/develop
- ✅ Executa diariamente às 2 AM UTC
- ✅ Testa vulnerabilidades em dependências
- ✅ Testa problemas de segurança no código
- ✅ Upload para GitHub Security

### Interpretando Resultados

#### Severidades

| Severidade | Ação | Descrição |
|------------|------|-----------|
| 🔴 **Critical** | Corrigir imediatamente | Exploração ativa |
| 🟠 **High** | Corrigir em 7 dias | Alto risco |
| 🟡 **Medium** | Corrigir em 30 dias | Risco moderado |
| 🟢 **Low** | Monitorar | Baixo risco |

#### Comandos Úteis

```bash
# Ver vulnerabilidades
snyk test

# Ver apenas high/critical
snyk test --severity-threshold=high

# Corrigir automaticamente
snyk fix

# Ignorar vulnerabilidade temporariamente
snyk ignore <SNYK-ID> --reason="Motivo" --expiry="2024-12-31"

# Gerar relatório
snyk test --json > snyk-report.json
```

---

## 🚀 Integração Contínua

### Fluxo Completo

1. **Developer** faz push/PR
2. **GitHub Actions** executa:
   - ✅ Lint & Type Check
   - ✅ Tests com cobertura
   - ✅ Build
   - ✅ SonarCloud análise
   - ✅ Snyk security scan
3. **SonarCloud** analisa qualidade
4. **Snyk** analisa segurança
5. **GitHub** mostra status checks
6. **Merge** só se todos passarem

### Comandos Locais

```bash
# Executar tudo localmente antes do push
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm build

# Análise de qualidade
sonar-scanner

# Análise de segurança
snyk test
snyk code test
```

---

## 📊 Métricas de Sucesso

### Objetivos

| Métrica | Meta Atual | Meta 3 Meses | Meta 6 Meses |
|---------|------------|--------------|--------------|
| **Cobertura de Testes** | 80% | 85% | 90% |
| **Quality Gate** | Passing | Passing | Passing |
| **Vulnerabilidades Critical** | 0 | 0 | 0 |
| **Vulnerabilidades High** | < 5 | 0 | 0 |
| **Code Smells** | < 100 | < 50 | < 20 |
| **Duplicação** | < 3% | < 2% | < 1% |

---

## 🔧 Troubleshooting

### SonarCloud

**Problema**: Análise falha com "Coverage report not found"

**Solução**:
```bash
# Verificar se coverage foi gerado
ls -la apps/api/coverage/lcov.info

# Executar testes com coverage
pnpm test:coverage
```

**Problema**: Quality Gate falha

**Solução**: Verifique as métricas no dashboard do SonarCloud e corrija os issues reportados.

### Snyk

**Problema**: "Authentication failed"

**Solução**:
```bash
# Re-autenticar
snyk auth

# Verificar token
echo $SNYK_TOKEN
```

**Problema**: Muitas vulnerabilidades

**Solução**:
```bash
# Atualizar dependências
pnpm update

# Corrigir automaticamente
snyk fix
```

---

## 📚 Recursos

### SonarCloud
- [Documentação oficial](https://docs.sonarcloud.io/)
- [Quality Gates](https://docs.sonarcloud.io/improving/quality-gates/)
- [Métricas](https://docs.sonarcloud.io/digging-deeper/metric-definitions/)

### Snyk
- [Documentação oficial](https://docs.snyk.io/)
- [CLI Reference](https://docs.snyk.io/snyk-cli)
- [Políticas](https://docs.snyk.io/manage-issues/policies)

---

## ✅ Checklist de Configuração

- [ ] Conta SonarCloud criada
- [ ] Projeto importado no SonarCloud
- [ ] `SONAR_TOKEN` configurado no GitHub
- [ ] Conta Snyk criada
- [ ] Projeto importado no Snyk
- [ ] `SNYK_TOKEN` configurado no GitHub
- [ ] Workflows testados (push para main)
- [ ] Quality Gate passando
- [ ] Vulnerabilidades críticas resolvidas
- [ ] Badges adicionados ao README
- [ ] Equipe treinada nos dashboards

---

**Status**: ✅ Configuração completa e pronta para uso!
