CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "relationship_type" AS ENUM ('father', 'mother', 'spouse', 'child');

CREATE TABLE "profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" TEXT NOT NULL,
    "normalized_name" TEXT,
    "date_of_birth" DATE,
    "date_of_death" DATE,
    "gender" TEXT,
    "notes" TEXT,
    "is_deceased" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "profiles_death_after_birth_check" CHECK (
        date_of_birth IS NULL
        OR date_of_death IS NULL
        OR date_of_death >= date_of_birth
    )
);

CREATE TABLE "relationships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "person_id" UUID NOT NULL,
    "related_person_id" UUID NOT NULL,
    "relationship_type" "relationship_type" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "relationships_no_self_link" CHECK (person_id <> related_person_id),
    CONSTRAINT "relationships_unique_link" UNIQUE ("person_id", "related_person_id", "relationship_type")
);

CREATE INDEX "idx_profiles_full_name"
ON "profiles" ("full_name");

CREATE INDEX "idx_profiles_normalized_name"
ON "profiles" ("normalized_name");

CREATE INDEX "idx_profiles_date_of_birth"
ON "profiles" ("date_of_birth");

CREATE INDEX "idx_relationships_person_id"
ON "relationships" ("person_id");

CREATE INDEX "idx_relationships_related_person_id"
ON "relationships" ("related_person_id");

CREATE INDEX "idx_relationships_type"
ON "relationships" ("relationship_type");

CREATE INDEX "idx_relationships_person_type"
ON "relationships" ("person_id", "relationship_type");

CREATE INDEX "idx_relationships_related_type"
ON "relationships" ("related_person_id", "relationship_type");

CREATE UNIQUE INDEX "unique_spouse_pair"
ON "relationships" (
    LEAST("person_id", "related_person_id"),
    GREATEST("person_id", "related_person_id")
)
WHERE "relationship_type" = 'spouse';

ALTER TABLE "relationships"
ADD CONSTRAINT "relationships_person_id_fkey"
FOREIGN KEY ("person_id") REFERENCES "profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "relationships"
ADD CONSTRAINT "relationships_related_person_id_fkey"
FOREIGN KEY ("related_person_id") REFERENCES "profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profiles_updated_at
BEFORE UPDATE ON "profiles"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
