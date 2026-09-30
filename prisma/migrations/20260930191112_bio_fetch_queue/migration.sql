-- Bio fetch queue: artists are saved immediately as stubs and their bios are
-- fetched later. Replaces the per-import job table.

-- AlterTable
ALTER TABLE "artists" ADD COLUMN     "fetch_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fetch_claimed_at" TIMESTAMP(3),
ADD COLUMN     "fetch_error" TEXT,
ADD COLUMN     "fetch_status" TEXT NOT NULL DEFAULT 'pending';

-- Artists whose bio was already fetched are done; stubs stay pending.
UPDATE "artists" SET "fetch_status" = 'fetched' WHERE "bio_last_fetched_at" IS NOT NULL;

-- Recover handles from imports that never finished (interrupted, rate limited,
-- cancelled) as pending stubs linked to the user who selected them.
CREATE TEMP TABLE "recovered_handles" AS
SELECT DISTINCT j."user_id", lower(regexp_replace(trim(h.value), '^@', '')) AS "handle"
FROM "import_jobs" j
CROSS JOIN LATERAL json_array_elements_text(j."handles"::json) AS h(value)
WHERE j."status" IN ('pending', 'processing', 'failed', 'cancelled')
  AND j."handles" LIKE '[%';

DELETE FROM "recovered_handles" WHERE "handle" !~ '^[a-z0-9._]{1,30}$';

INSERT INTO "artists" ("id", "instagram_handle", "updated_at")
SELECT gen_random_uuid()::text, r."handle", CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "handle" FROM "recovered_handles") r
ON CONFLICT ("instagram_handle") DO NOTHING;

INSERT INTO "user_artists" ("id", "user_id", "artist_id")
SELECT gen_random_uuid()::text, r."user_id", a."id"
FROM "recovered_handles" r
JOIN "artists" a ON a."instagram_handle" = r."handle"
ON CONFLICT ("user_id", "artist_id") DO NOTHING;

DROP TABLE "recovered_handles";

-- DropForeignKey
ALTER TABLE "import_jobs" DROP CONSTRAINT "import_jobs_user_id_fkey";

-- DropTable
DROP TABLE "import_jobs";

-- CreateIndex
CREATE INDEX "artists_fetch_status_idx" ON "artists"("fetch_status");
