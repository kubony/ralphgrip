-- Extend project key length from 2-5 to 2-10 characters
-- to support longer project keys like TYMPRISS

ALTER TABLE public.projects DROP CONSTRAINT projects_key_format;
ALTER TABLE public.projects ADD CONSTRAINT projects_key_format CHECK (key ~ '^[A-Z]{2,10}$');
