-- Storage bucket for image attachments (private, 5MB limit, image/* only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,
  5242880, -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: project members can view
CREATE POLICY "Project members can view attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments'
  AND EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = (storage.foldername(name))[1]::uuid
      AND project_members.user_id = (SELECT auth.uid())
  )
);

-- Storage RLS: project members (non-viewer) can upload
CREATE POLICY "Project members can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = (storage.foldername(name))[1]::uuid
      AND project_members.user_id = (SELECT auth.uid())
      AND project_members.role != 'viewer'
  )
);

-- Storage RLS: owner can delete own files
CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND owner_id = (SELECT auth.uid())::text
);

-- Add attachments JSONB column to comments
ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.comments.attachments IS '첨부 이미지 메타데이터 [{id, storage_path, file_name, file_size, content_type}]';
