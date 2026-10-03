-- =============================================================
-- fix-storage.sql
-- Ejecuta este script en: Supabase → SQL Editor → New Query
-- Crea el bucket "album-media" y sus políticas públicas de acceso
-- =============================================================

-- 1. Crear el bucket público (si no existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'album-media',
  'album-media',
  true,
  52428800,   -- límite: 50 MB por archivo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'];

-- 2. Limpiar políticas antiguas (idempotente)
DROP POLICY IF EXISTS "Public media read"   ON storage.objects;
DROP POLICY IF EXISTS "Public media insert" ON storage.objects;
DROP POLICY IF EXISTS "Public media update" ON storage.objects;
DROP POLICY IF EXISTS "Public media delete" ON storage.objects;

-- 3. Cualquiera puede ver las fotos/videos del álbum compartido
CREATE POLICY "Public media read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'album-media');

-- 4. Cualquiera puede subir fotos/videos al álbum compartido
CREATE POLICY "Public media insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'album-media');

-- 5. Cualquiera puede sobreescribir medios existentes
CREATE POLICY "Public media update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'album-media');

-- 6. Cualquiera puede eliminar medios
CREATE POLICY "Public media delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'album-media');
