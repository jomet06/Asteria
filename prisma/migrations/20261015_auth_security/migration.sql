
BEGIN;

-- =====================================================
-- 1. Link profiles to Supabase Auth users
-- =====================================================

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_auth_user_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- =====================================================
-- 2. Secure profiles
-- =====================================================

ALTER TABLE public.profiles
ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
ON TABLE public.profiles
FROM anon, authenticated;

-- =====================================================
-- 3. Secure Prisma migration history
-- =====================================================

ALTER TABLE public._prisma_migrations
ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
ON TABLE public._prisma_migrations
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
