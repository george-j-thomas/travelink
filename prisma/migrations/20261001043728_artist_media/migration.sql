-- AlterTable
ALTER TABLE "artists" ADD COLUMN     "media_claimed_at" TIMESTAMP(3),
ADD COLUMN     "media_last_fetched_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "artist_media" (
    "id" TEXT NOT NULL,
    "artist_id" TEXT NOT NULL,
    "ig_media_id" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "permalink" TEXT NOT NULL,
    "caption" TEXT,
    "taken_at" TIMESTAMP(3) NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artist_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "artist_media_artist_id_idx" ON "artist_media"("artist_id");

-- CreateIndex
CREATE UNIQUE INDEX "artist_media_artist_id_ig_media_id_key" ON "artist_media"("artist_id", "ig_media_id");

-- AddForeignKey
ALTER TABLE "artist_media" ADD CONSTRAINT "artist_media_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
