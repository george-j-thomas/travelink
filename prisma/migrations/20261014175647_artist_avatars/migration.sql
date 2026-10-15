-- CreateTable
CREATE TABLE "artist_avatars" (
    "id" TEXT NOT NULL,
    "artist_id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "content_type" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artist_avatars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "artist_avatars_artist_id_key" ON "artist_avatars"("artist_id");

-- AddForeignKey
ALTER TABLE "artist_avatars" ADD CONSTRAINT "artist_avatars_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
