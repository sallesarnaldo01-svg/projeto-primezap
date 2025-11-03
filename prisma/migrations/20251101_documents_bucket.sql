-- Create 'documents' bucket for non-Supabase environments (idempotente)
INSERT INTO storage.buckets (id, name, public)
SELECT 'documents', 'documents', false
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'documents'
);

