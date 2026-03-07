-- search_path 고정으로 security advisor 경고 해결
ALTER FUNCTION public.get_app_role() SET search_path = public;
ALTER FUNCTION public.is_app_user() SET search_path = public;
ALTER FUNCTION public.update_user_app_role(uuid, text) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
