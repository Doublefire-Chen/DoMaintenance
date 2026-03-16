-- DoMaintenance Database Schema
-- Run this file against an empty PostgreSQL database to set up all tables.
-- Usage: psql -d domaintenance -f schema.sql

-- 1. Registrars
CREATE TABLE IF NOT EXISTS registrars (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE,
    website VARCHAR,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- 2. Tags
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE,
    color VARCHAR(7),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- 3. Domains
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY,
    name VARCHAR(253) NOT NULL,
    registrar_id UUID REFERENCES registrars(id) ON DELETE SET NULL,
    registration_date DATE,
    expiration_date DATE NOT NULL,
    renewal_days INTEGER NOT NULL DEFAULT 365,
    renew_price DECIMAL(10, 2),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    masking_level SMALLINT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- 4. Domain-Tag junction table
CREATE TABLE IF NOT EXISTS domain_tags (
    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (domain_id, tag_id)
);

-- 5. Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR NOT NULL UNIQUE,
    password_hash VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- 6. Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- 7. Exchange rates (cached from external API)
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY,
    base_currency VARCHAR(3) NOT NULL,
    target_currency VARCHAR(3) NOT NULL,
    rate DECIMAL(16, 6) NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL
);
