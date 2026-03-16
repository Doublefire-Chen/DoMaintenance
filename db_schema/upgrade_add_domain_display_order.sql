ALTER TABLE domains
    ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

WITH ordered_domains AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, name ASC) - 1 AS new_display_order
    FROM domains
)
UPDATE domains
SET display_order = ordered_domains.new_display_order
FROM ordered_domains
WHERE domains.id = ordered_domains.id;
