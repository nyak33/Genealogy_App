ALTER TABLE "profiles"
ADD COLUMN "is_merged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "merged_into_profile_id" UUID,
ADD COLUMN "merged_at" TIMESTAMPTZ(6);

CREATE INDEX "idx_profiles_is_merged"
ON "profiles" ("is_merged");

CREATE INDEX "idx_profiles_merged_into_profile_id"
ON "profiles" ("merged_into_profile_id");

ALTER TABLE "profiles"
ADD CONSTRAINT "profiles_merged_into_not_self_check"
CHECK ("merged_into_profile_id" IS NULL OR "merged_into_profile_id" <> "id");

ALTER TABLE "profiles"
ADD CONSTRAINT "profiles_merged_state_check"
CHECK (
    "is_merged" = false
    OR (
        "merged_into_profile_id" IS NOT NULL
        AND "merged_at" IS NOT NULL
    )
);

ALTER TABLE "profiles"
ADD CONSTRAINT "profiles_merged_into_profile_id_fkey"
FOREIGN KEY ("merged_into_profile_id") REFERENCES "profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
