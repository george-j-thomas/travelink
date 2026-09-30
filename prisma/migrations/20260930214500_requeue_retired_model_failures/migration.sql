-- Data-only: re-queue bio fetches that failed because the Claude model ID was retired
UPDATE "artists"
SET "fetch_status" = 'pending', "fetch_attempts" = 0, "fetch_error" = NULL
WHERE "fetch_status" IN ('pending', 'failed')
  AND "fetch_error" LIKE '%not_found_error%model:%';
