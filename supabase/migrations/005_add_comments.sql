-- Add comments table
-- ==================

-- Comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_comments_work_item ON public.comments(work_item_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON public.comments(author_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_comments_updated_at ON public.comments;
CREATE TRIGGER trigger_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_comments_updated_at();

-- RLS policies for comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Users can read comments on work items they have access to
CREATE POLICY "Users can view comments on accessible work items"
  ON public.comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.work_items w
      JOIN public.project_members pm ON pm.project_id = w.project_id
      WHERE w.id = comments.work_item_id
        AND pm.user_id = auth.uid()
    )
  );

-- Users can create comments on work items they have access to
CREATE POLICY "Users can create comments on accessible work items"
  ON public.comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.work_items w
      JOIN public.project_members pm ON pm.project_id = w.project_id
      WHERE w.id = comments.work_item_id
        AND pm.user_id = auth.uid()
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON public.comments
  FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON public.comments
  FOR DELETE
  USING (auth.uid() = author_id);
