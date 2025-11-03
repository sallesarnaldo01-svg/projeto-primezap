# 🔧 Guia de Configuração - Patch 4: Produtos e Mídia

Este guia detalha como configurar e utilizar as novas funcionalidades de produtos e mídia.

---

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Configuração da API do Gemini](#configuração-da-api-do-gemini)
3. [Como Utilizar o Gerenciador de Produtos](#como-utilizar-o-gerenciador-de-produtos)
4. [Como Utilizar o Gerenciador de Mídia](#como-utilizar-o-gerenciador-de-mídia)
5. [Troubleshooting](#troubleshooting)

---

## Pré-requisitos

- **Patch 4 instalado**: Certifique-se de que o script de instalação foi executado com sucesso.
- **Acesso de Administrador**: Você precisa de permissões de administrador no Primeflow-Hub.

---

## Configuração da API do Gemini

Para utilizar as funcionalidades de Inteligência Artificial (auto-tagging, descrição de produtos, etc.), você precisa de uma chave de API do Google Gemini.

### Passo 1: Obter a Chave da API

1. Acesse o **[Google AI Studio](https://aistudio.google.com/)**.
2. Faça login com sua conta do Google.
3. Clique em **"Get API key"** no menu à esquerda.
4. Clique em **"Create API key in new project"**.
5. Copie a chave da API gerada. Ela será algo como `AIzaSy...`.

### Passo 2: Configurar a Chave no Primeflow-Hub

1. Abra o arquivo `.env` na raiz do seu projeto Primeflow-Hub:
   ```bash
   nano /home/administrator/unified/primeflow-hub-main/.env
   ```

2. Adicione a seguinte linha no final do arquivo, substituindo `SUA_CHAVE_API_AQUI` pela chave que você copiou:
   ```env
   # Patch 4: Configuração de IA
   GEMINI_API_KEY=SUA_CHAVE_API_AQUI
   ```

3. Salve o arquivo e reinicie o servidor do Primeflow-Hub para que as alterações tenham efeito:
   ```bash
   # Se estiver rodando com pnpm dev
   # Pare o processo (Ctrl+C) e inicie novamente
   pnpm dev

   # Se estiver usando PM2
   pm2 restart primeflow-api
   ```

**Pronto!** As funcionalidades de IA agora estão ativas.

---

## Como Utilizar o Gerenciador de Produtos

Acesse a nova página **"Produtos"** no menu lateral do Primeflow-Hub.

### Criando um Novo Produto

1. Clique no botão **"Novo Produto"**.
2. Preencha os campos do formulário:
   - **Nome**: O nome do seu produto (obrigatório).
   - **Descrição**: Uma descrição detalhada.
   - **Preço**: O preço de venda (obrigatório).
   - **Estoque**: A quantidade disponível.
   - **Imagens**: Faça o upload das imagens do produto. A IA irá gerar tags automaticamente se a opção estiver habilitada.
   - **Tags**: Adicione tags manualmente para melhorar a busca.
3. Clique em **"Criar"**.

### Editando um Produto

1. Clique no botão **"Editar"** em um dos cards de produto.
2. Modifique os campos desejados no formulário.
3. Clique em **"Salvar"**.

### Buscando e Filtrando

- Utilize a **barra de busca** para encontrar produtos por nome, descrição ou SKU.
- Use o **seletor de categorias** para filtrar os produtos.

---

## Como Utilizar o Gerenciador de Mídia

O gerenciador de mídia está integrado ao formulário de produtos, mas também pode ser estendido para uma página dedicada no futuro.

### Upload de Imagens

1. No formulário de criação/edição de produto, na seção **"Imagens"**, clique para selecionar os arquivos ou arraste e solte as imagens.
2. As imagens serão enviadas e as thumbnails aparecerão.
3. Se a IA estiver configurada, as tags serão geradas e adicionadas ao campo **"Tags"** automaticamente.

### Análise com IA

Além do auto-tagging, o serviço de IA (`ai-media.service.ts`) pode ser utilizado para:

- **Gerar descrições de produtos**: Chame a função `generateProductDescription` para criar textos de venda a partir de uma imagem.
- **Analisar a qualidade da imagem**: Use `analyzeImageQuality` para receber um score e sugestões de melhoria para suas fotos de produto.
- **Sugerir categorias**: A função `suggestCategory` pode ajudar a classificar seus produtos automaticamente.

---

## Troubleshooting

### Funcionalidades de IA não funcionam

**Sintoma**: As tags não são geradas automaticamente, ou ocorrem erros relacionados à IA.

**Soluções**:
1. **Verifique a Chave da API**: Certifique-se de que a `GEMINI_API_KEY` no arquivo `.env` está correta e não possui espaços extras.
2. **Reinicie o Servidor**: Após adicionar a chave, o servidor do backend precisa ser reiniciado.
3. **Verifique a Conexão com a Internet**: O servidor precisa de acesso à internet para se comunicar com a API do Google.
4. **Consulte os Logs**: Verifique os logs do backend para mensagens de erro específicas da API do Gemini.
   ```bash
   tail -f apps/api/logs/error.log
   ```

### Erro no Upload de Arquivos

**Sintoma**: O upload de imagens falha ou retorna um erro.

**Soluções**:
1. **Verifique as Permissões da Pasta**: A pasta `uploads/media` na raiz do projeto precisa de permissões de escrita para o usuário que está executando o servidor.
   ```bash
   sudo chown -R ubuntu:ubuntu uploads
   sudo chmod -R 755 uploads
   ```
2. **Verifique o Tamanho do Arquivo**: O limite padrão é de 50MB por arquivo. Verifique se seus arquivos não excedem esse limite.
3. **Consulte os Logs**: Verifique os logs do backend para erros relacionados ao `multer` ou `sharp`.

---

**Versão**: 1.0.0  
**Última Atualização**: 12/10/2025

