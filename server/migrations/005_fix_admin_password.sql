-- server/migrations/005_fix_admin_password.sql
--
-- The seed admin user (admin@sahamscreen.id / admin123) shipped with an
-- invalid bcrypt hash placeholder that did not actually verify against
-- the documented password. Existing installs already have that row, so
-- the ON CONFLICT (email) DO NOTHING in 001_init.sql cannot replace it
-- on its own. This migration overwrites the password_hash with a real
-- cost-10 bcrypt hash for "admin123" so the documented credentials work.
--
-- Idempotent: rerunning is a no-op because we WHERE-filter on the bad
-- placeholder hash and the documented email.

UPDATE users
SET password_hash = '$2b$10$LYKuivom1p4HfGxD3QLQt.DJ.mF6LgBe4ykfrO6rdz6hkxp.Q4j3K',
    role          = 'admin',
    name          = 'Administrator',
    updated_at    = NOW()
WHERE email = 'admin@sahamscreen.id'
  AND password_hash = '$2a$10$w6D9t.T3L30q.qZqM/q9w.y901z4h7.YxT9UaI/xS74lYJkZ6yXgW';
