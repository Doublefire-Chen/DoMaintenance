ALTER TABLE domains
    ALTER COLUMN registration_date TYPE TIMESTAMPTZ
    USING CASE
        WHEN registration_date IS NULL THEN NULL
        ELSE registration_date::timestamp AT TIME ZONE 'UTC'
    END,
    ALTER COLUMN expiration_date TYPE TIMESTAMPTZ
    USING expiration_date::timestamp AT TIME ZONE 'UTC';
