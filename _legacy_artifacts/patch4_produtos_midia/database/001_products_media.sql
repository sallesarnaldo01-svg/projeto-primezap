-- ============================================================
-- Patch 4: Produtos e Mídia - Database Migration
-- Primeflow-Hub
-- Versão: 1.0.0
-- Data: 12/10/2025
-- ============================================================

-- Tabela de Produtos
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sku VARCHAR(100),
  price DECIMAL(10, 2) NOT NULL,
  compare_at_price DECIMAL(10, 2),
  cost DECIMAL(10, 2),
  stock INTEGER DEFAULT 0,
  category VARCHAR(100),
  tags TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT products_price_positive CHECK (price >= 0),
  CONSTRAINT products_stock_non_negative CHECK (stock >= 0)
);

-- Índices para produtos
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);

-- Tabela de Variantes de Produtos
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  price DECIMAL(10, 2) NOT NULL,
  compare_at_price DECIMAL(10, 2),
  cost DECIMAL(10, 2),
  stock INTEGER DEFAULT 0,
  options JSONB DEFAULT '{}', -- Ex: {"size": "M", "color": "Blue"}
  images TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT variants_price_positive CHECK (price >= 0),
  CONSTRAINT variants_stock_non_negative CHECK (stock >= 0)
);

-- Índices para variantes
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_variants_is_active ON product_variants(is_active);

-- Tabela de Mídia
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para mídia
CREATE INDEX IF NOT EXISTS idx_media_tenant ON media(tenant_id);
CREATE INDEX IF NOT EXISTS idx_media_filename ON media(filename);
CREATE INDEX IF NOT EXISTS idx_media_mime_type ON media(mime_type);
CREATE INDEX IF NOT EXISTS idx_media_tags ON media USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_media_created ON media(created_at DESC);

-- Tabela de Histórico de Estoque
CREATE TABLE IF NOT EXISTS stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  operation VARCHAR(20) NOT NULL, -- 'add', 'subtract', 'set'
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reason VARCHAR(255),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_history_product_or_variant CHECK (
    (product_id IS NOT NULL AND variant_id IS NULL) OR
    (product_id IS NULL AND variant_id IS NOT NULL)
  )
);

-- Índices para histórico de estoque
CREATE INDEX IF NOT EXISTS idx_stock_history_tenant ON stock_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_product ON stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_variant ON stock_history(variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_created ON stock_history(created_at DESC);

-- Tabela de Catálogos (para organizar produtos)
CREATE TABLE IF NOT EXISTS catalogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para catálogos
CREATE INDEX IF NOT EXISTS idx_catalogs_tenant ON catalogs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_catalogs_is_active ON catalogs(is_active);

-- Tabela de relação Produtos-Catálogos (muitos para muitos)
CREATE TABLE IF NOT EXISTS catalog_products (
  catalog_id UUID NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (catalog_id, product_id)
);

-- Índices para relação produtos-catálogos
CREATE INDEX IF NOT EXISTS idx_catalog_products_catalog ON catalog_products(catalog_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_product ON catalog_products(product_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_position ON catalog_products(position);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_variants_updated_at ON product_variants;
CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_media_updated_at ON media;
CREATE TRIGGER update_media_updated_at
  BEFORE UPDATE ON media
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_catalogs_updated_at ON catalogs;
CREATE TRIGGER update_catalogs_updated_at
  BEFORE UPDATE ON catalogs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para registrar histórico de estoque automaticamente
CREATE OR REPLACE FUNCTION log_stock_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stock IS DISTINCT FROM NEW.stock THEN
    INSERT INTO stock_history (
      tenant_id,
      product_id,
      operation,
      quantity,
      previous_stock,
      new_stock,
      reason
    ) VALUES (
      NEW.tenant_id,
      NEW.id,
      CASE
        WHEN NEW.stock > OLD.stock THEN 'add'
        WHEN NEW.stock < OLD.stock THEN 'subtract'
        ELSE 'set'
      END,
      ABS(NEW.stock - OLD.stock),
      OLD.stock,
      NEW.stock,
      'Automatic stock update'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_product_stock_change ON products;
CREATE TRIGGER log_product_stock_change
  AFTER UPDATE ON products
  FOR EACH ROW
  WHEN (OLD.stock IS DISTINCT FROM NEW.stock)
  EXECUTE FUNCTION log_stock_change();

-- Inserir dados de exemplo (opcional - comentado)
-- INSERT INTO products (tenant_id, name, description, price, stock, category, tags) VALUES
-- ((SELECT id FROM tenants LIMIT 1), 'Produto Exemplo', 'Descrição do produto exemplo', 99.90, 10, 'Eletrônicos', ARRAY['exemplo', 'teste']);

-- Comentários nas tabelas
COMMENT ON TABLE products IS 'Produtos do catálogo';
COMMENT ON TABLE product_variants IS 'Variantes de produtos (tamanhos, cores, etc)';
COMMENT ON TABLE media IS 'Arquivos de mídia (imagens, vídeos, etc)';
COMMENT ON TABLE stock_history IS 'Histórico de movimentações de estoque';
COMMENT ON TABLE catalogs IS 'Catálogos para organizar produtos';
COMMENT ON TABLE catalog_products IS 'Relação muitos-para-muitos entre catálogos e produtos';

-- Permissões (ajustar conforme necessário)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON products TO primeflow_api;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON product_variants TO primeflow_api;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON media TO primeflow_api;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON stock_history TO primeflow_api;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON catalogs TO primeflow_api;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON catalog_products TO primeflow_api;

-- ============================================================
-- Fim da Migration
-- ============================================================

