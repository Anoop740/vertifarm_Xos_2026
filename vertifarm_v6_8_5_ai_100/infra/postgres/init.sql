-- VertiFarm OS — Database Initialization
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Ensure timezone is set
SET timezone = 'UTC';
