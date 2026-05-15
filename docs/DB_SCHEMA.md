# DB_SCHEMA.md

# Genealogy / Family Tree App MVP  
## Database Schema Documentation

---

## 1. Database Direction

This project uses **PostgreSQL** as the MVP database.

The database must be designed around structured records, not plain text relationship fields.

Core rule:

```text
A person is stored once in profiles.
Family links are stored separately in relationships.
```

Do not store father, mother, spouse, or children as plain text columns inside `profiles`.

---

## 2. Main Database Principles

### 2.1 Use UUID Primary Keys

Every important record should use UUID.

Reason:

- Names are not unique.
- People can share the same full name.
- Names can change.
- UUID is safer for relationship linking.
- UUID works better for future API and multi-user systems.

### 2.2 Use Clear Column Names

Use clear names instead of unclear abbreviations.

Use:

```text
date_of_birth
date_of_death
```

Avoid:

```text
dob
dod
```

Reason:

`dod` can mean many things in other systems. In this genealogy app, clear naming is better for long-term readability.

### 2.3 Relationships Must Use IDs

Correct:

```text
person_id -> relationship_type -> related_person_id
```

Wrong:

```text
father_name = "Jordan Carter"
```

### 2.4 Avoid Premature Complexity

The schema should support future growth, but MVP should stay practical.

Do not add complex genealogy rules too early.

---

## 3. Required Extensions

Recommended PostgreSQL extensions:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

This allows UUID generation using:

```sql
gen_random_uuid()
```

Optional future extension:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

`pg_trgm` can improve fuzzy name search later.

For MVP, `ILIKE` search is acceptable.

---

## 4. Core Tables Overview

MVP core tables:

1. `profiles`
2. `relationships`

Future-ready tables:

3. `media`
4. `media_tags`

Milestone 2 implementation note:

- The checked-in initial migration creates only `profiles` and `relationships`.
- `media` and `media_tags` remain documented for future work, but are not created yet.

Recommended future audit table:

5. `profile_change_logs`

Not required for first MVP unless needed.

---

# 5. Table: profiles

## 5.1 Purpose

Stores one record per person.

A person can be alive or deceased. The record may be incomplete at first.

The system should allow quick creation with only a full name, then more details can be added later.

---

## 5.2 Recommended SQL

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    full_name TEXT NOT NULL,
    normalized_name TEXT,

    date_of_birth DATE,
    date_of_death DATE,

    gender TEXT,
    notes TEXT,

    is_deceased BOOLEAN DEFAULT FALSE,
    is_merged BOOLEAN DEFAULT FALSE,
    merged_into_profile_id UUID REFERENCES profiles(id),
    merged_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 5.3 Field Explanation

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Unique ID for each person profile |
| full_name | TEXT | Yes | Full legal name or commonly used name |
| normalized_name | TEXT | No | Lowercase / cleaned version of name for search and duplicate checks |
| date_of_birth | DATE | No | Person's birth date |
| date_of_death | DATE | No | Person's death date, only filled if deceased |
| gender | TEXT | No | Optional gender value |
| notes | TEXT | No | General notes about the person |
| is_deceased | BOOLEAN | No | Indicates whether the person is deceased |
| is_merged | BOOLEAN | No | Indicates this profile has been merged into another profile |
| merged_into_profile_id | UUID | No | Primary profile this duplicate profile was merged into |
| merged_at | TIMESTAMPTZ | No | Timestamp when this profile was marked as merged |
| created_at | TIMESTAMPTZ | Yes | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | Last update timestamp |

---

## 5.4 Notes on Date Fields

### date_of_birth

The person's birth date.

This field is optional because the user may not know the exact birth date.

### date_of_death

The person's death date.

This field is optional and should only be filled if the person is deceased.

### is_deceased

This can be used for UI filtering and display.

Example:

```text
If date_of_death is filled, is_deceased should normally be true.
```

---

## 5.5 Gender Field

For MVP, `gender` can be simple text.

Recommended values:

```text
male
female
unknown
other
```

Optional database constraint:

```sql
ALTER TABLE profiles
ADD CONSTRAINT profiles_gender_check
CHECK (gender IN ('male', 'female', 'unknown', 'other') OR gender IS NULL);
```

If the frontend is not ready to enforce controlled values, skip the constraint first.

---

## 5.6 Recommended Indexes

```sql
CREATE INDEX idx_profiles_full_name
ON profiles (full_name);

CREATE INDEX idx_profiles_normalized_name
ON profiles (normalized_name);

CREATE INDEX idx_profiles_date_of_birth
ON profiles (date_of_birth);
```

For MVP partial search using `ILIKE`, a normal btree index may not fully optimize `%term%` search.

Future improvement with `pg_trgm`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_profiles_full_name_trgm
ON profiles
USING gin (full_name gin_trgm_ops);
```

---

## 5.7 Merge Fields

Soft merge support keeps duplicate profiles in the database instead of hard deleting them.

When a duplicate profile is merged into a primary profile:

```text
is_merged = true
merged_into_profile_id = primary profile ID
merged_at = merge timestamp
```

The duplicate record remains available for audit and direct lookup, while future application logic can hide merged profiles from normal lists and search results.

Database-level merge checks:

```sql
CHECK (merged_into_profile_id IS NULL OR merged_into_profile_id <> id)
```

```sql
CHECK (
    is_merged = false
    OR (
        merged_into_profile_id IS NOT NULL
        AND merged_at IS NOT NULL
    )
)
```

Recommended merge indexes:

```sql
CREATE INDEX idx_profiles_is_merged
ON profiles (is_merged);

CREATE INDEX idx_profiles_merged_into_profile_id
ON profiles (merged_into_profile_id);
```

---

## 5.8 Validation Rules

Application-level validation:

- `full_name` must not be empty.
- `date_of_death` should not be earlier than `date_of_birth`.
- If `date_of_death` exists, `is_deceased` should normally be true.
- Whitespace should be trimmed from `full_name`.

Optional database check:

```sql
ALTER TABLE profiles
ADD CONSTRAINT profiles_death_after_birth_check
CHECK (
    date_of_birth IS NULL
    OR date_of_death IS NULL
    OR date_of_death >= date_of_birth
);
```

---

# 6. Table: relationships

## 6.1 Purpose

Stores links between two person profiles.

This is the most important table for the family tree.

Each relationship row means:

```text
person_id has relationship_type with related_person_id
```

Example:

```text
Alex Carter -> father -> Jordan Carter
```

This means:

- `person_id` = Alex Carter profile ID
- `relationship_type` = father
- `related_person_id` = Jordan Carter profile ID

---

## 6.2 Recommended SQL

Implementation note:

The Prisma implementation uses a PostgreSQL enum named `relationship_type` for the same MVP values instead of a plain `TEXT` column plus type-check constraint.

```sql
CREATE TABLE relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    person_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    related_person_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    relationship_type TEXT NOT NULL,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT relationships_no_self_link
    CHECK (person_id <> related_person_id),

    CONSTRAINT relationships_type_check
    CHECK (relationship_type IN ('father', 'mother', 'spouse', 'child')),

    CONSTRAINT relationships_unique_link
    UNIQUE (person_id, related_person_id, relationship_type)
);
```

---

## 6.3 Field Explanation

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Unique relationship record ID |
| person_id | UUID | Yes | Main profile ID |
| related_person_id | UUID | Yes | Related profile ID |
| relationship_type | TEXT | Yes | Type of family relationship |
| notes | TEXT | No | Optional note for relationship context |
| created_at | TIMESTAMPTZ | Yes | Relationship creation timestamp |

---

## 6.4 Allowed MVP Relationship Types

| Type | Meaning |
|---|---|
| father | related person is the father of person |
| mother | related person is the mother of person |
| spouse | related person is the spouse of person |
| child | related person is the child of person |

---

## 6.5 Relationship Direction Rules

### father

```text
person_id -> father -> related_person_id
```

Example:

```text
Child -> father -> Father
```

### mother

```text
person_id -> mother -> related_person_id
```

Example:

```text
Child -> mother -> Mother
```

### spouse

```text
person_id -> spouse -> related_person_id
```

Example:

```text
Person A -> spouse -> Person B
```

Spouse relationship is naturally bidirectional.

There are two possible implementation strategies:

### Option A: Store One Row Only

Store:

```text
A -> spouse -> B
```

When displaying B's profile, query both directions.

Pros:

- Less duplicate data
- Cleaner table

Cons:

- Query is slightly more complex

### Option B: Store Two Rows

Store:

```text
A -> spouse -> B
B -> spouse -> A
```

Pros:

- Simple query

Cons:

- Risk of inconsistent data

### MVP Recommendation

Use **Option A**.

Store one spouse relationship row and make backend query both directions.

---

### child

```text
person_id -> child -> related_person_id
```

Example:

```text
Parent -> child -> Child
```

For MVP, be careful with duplicated meaning.

If you already store:

```text
Child -> father -> Father
```

You may not need to also store:

```text
Father -> child -> Child
```

Otherwise, the same real-world relationship is stored twice.

### MVP Recommendation

Prefer parent relationships as the source of truth:

```text
Child -> father -> Father
Child -> mother -> Mother
```

Then derive children by querying reverse father/mother relationships.

However, because the MVP form includes "Children", the backend can accept child input and convert it into the correct parent relationship where possible.

Example:

If user is editing a male profile and adds a child:

```text
Child -> father -> Current Profile
```

If user is editing a female profile and adds a child:

```text
Child -> mother -> Current Profile
```

If gender is unknown, the system may store:

```text
Current Profile -> child -> Child
```

or ask the user to choose relationship type.

Keep this behaviour clearly documented in the backend.

---

## 6.6 Recommended Indexes

```sql
CREATE INDEX idx_relationships_person_id
ON relationships (person_id);

CREATE INDEX idx_relationships_related_person_id
ON relationships (related_person_id);

CREATE INDEX idx_relationships_type
ON relationships (relationship_type);

CREATE INDEX idx_relationships_person_type
ON relationships (person_id, relationship_type);

CREATE INDEX idx_relationships_related_type
ON relationships (related_person_id, relationship_type);
```

---

## 6.7 Recommended Constraints

### Prevent Self Relationship

Already included:

```sql
CHECK (person_id <> related_person_id)
```

This prevents:

```text
Alex Carter -> father -> Alex Carter
```

### Prevent Duplicate Exact Relationship

Already included:

```sql
UNIQUE (person_id, related_person_id, relationship_type)
```

This prevents duplicate rows like:

```text
Alex Carter -> father -> Jordan Carter
Alex Carter -> father -> Jordan Carter
```

### Optional: One Father and One Mother

This is stricter and may be added later.

Example:

```sql
CREATE UNIQUE INDEX unique_one_father_per_person
ON relationships (person_id)
WHERE relationship_type = 'father';

CREATE UNIQUE INDEX unique_one_mother_per_person
ON relationships (person_id)
WHERE relationship_type = 'mother';
```

MVP note:

This is useful for biological parent records, but it may become limiting later if the app supports adoptive or step relationships.

Recommendation:

- Add this only if the MVP wants strict biological father/mother rules.
- Otherwise enforce with application logic first.

---

# 7. Table: media

## 7.1 Purpose

Future-ready table for storing uploaded family photo references.

For MVP, this table can exist without full UI.

It should store metadata, not necessarily the raw file itself.

The actual image file can later be stored in object storage such as:

- Supabase Storage
- S3-compatible storage
- Local storage during development

---

## 7.2 Recommended SQL

```sql
CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    file_url TEXT NOT NULL,
    file_name TEXT,
    file_type TEXT,
    file_size_bytes BIGINT,

    uploaded_by UUID,
    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 7.3 Field Explanation

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Unique media record ID |
| file_url | TEXT | Yes | URL/path to uploaded file |
| file_name | TEXT | No | Original or stored file name |
| file_type | TEXT | No | MIME type or file type |
| file_size_bytes | BIGINT | No | File size in bytes |
| uploaded_by | UUID | No | Future user ID who uploaded the file |
| description | TEXT | No | Optional image description |
| created_at | TIMESTAMPTZ | Yes | Upload record timestamp |

---

## 7.4 Notes

`uploaded_by` is nullable because user accounts may not exist in the MVP yet.

When authentication is added later, this can reference a `users` table.

---

# 8. Table: media_tags

## 8.1 Purpose

Future-ready table for tagging profiles inside photos.

Example:

A family portrait has 5 faces. Each face can be linked to a profile.

---

## 8.2 Recommended SQL

```sql
CREATE TABLE media_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    face_box JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT media_tags_unique_profile_per_media
    UNIQUE (media_id, profile_id)
);
```

---

## 8.3 Field Explanation

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Unique media tag ID |
| media_id | UUID | Yes | Linked media record |
| profile_id | UUID | Yes | Tagged person profile |
| face_box | JSONB | No | Face position box inside image |
| created_at | TIMESTAMPTZ | Yes | Tag creation timestamp |

---

## 8.4 face_box Format

Recommended JSON format:

```json
{
  "x": 120,
  "y": 80,
  "width": 60,
  "height": 60
}
```

Where:

| Key | Meaning |
|---|---|
| x | Horizontal position from left |
| y | Vertical position from top |
| width | Face box width |
| height | Face box height |

This can support manual face tagging first, then AI-assisted detection later.

---

## 8.5 Recommended Indexes

```sql
CREATE INDEX idx_media_tags_media_id
ON media_tags (media_id);

CREATE INDEX idx_media_tags_profile_id
ON media_tags (profile_id);
```

---

# 9. Optional Future Table: profile_change_logs

## 9.1 Purpose

Tracks changes made to profiles.

Not required for first MVP, but useful when family contribution is added.

---

## 9.2 Future SQL Example

```sql
CREATE TABLE profile_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    changed_by UUID,
    change_type TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 9.3 Future Use Cases

- Track who edited a profile
- Review suggested changes
- Restore previous value
- Show contribution history

Do not build this unless needed.

---

# 10. Duplicate Detection Logic

Duplicate detection should be handled mainly in application logic.

## 10.1 Basic Duplicate Check

When creating a profile, check:

1. Same or similar full name
2. Same date of birth if provided
3. Same date of death if provided

Example SQL:

```sql
SELECT
    id,
    full_name,
    date_of_birth,
    date_of_death
FROM profiles
WHERE full_name ILIKE '%' || $1 || '%'
LIMIT 10;
```

## 10.2 Stronger Duplicate Check

If `normalized_name` is available:

```sql
SELECT
    id,
    full_name,
    date_of_birth,
    date_of_death
FROM profiles
WHERE normalized_name = $1
   OR full_name ILIKE '%' || $2 || '%'
LIMIT 10;
```

## 10.3 Duplicate Warning Behaviour

The backend should return possible matches.

The frontend should show:

```text
Possible duplicate profiles found.
Use existing profile or continue creating a new profile?
```

The system should not silently block the user because two different people can share similar names.

---

# 11. Search Queries

## 11.1 Basic Partial Search

```sql
SELECT
    id,
    full_name,
    date_of_birth,
    date_of_death
FROM profiles
WHERE full_name ILIKE '%' || $1 || '%'
ORDER BY full_name ASC
LIMIT 20;
```

## 11.2 Search With Normalized Name

```sql
SELECT
    id,
    full_name,
    date_of_birth,
    date_of_death
FROM profiles
WHERE normalized_name ILIKE '%' || $1 || '%'
ORDER BY full_name ASC
LIMIT 20;
```

## 11.3 Future Fuzzy Search

Requires:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Example:

```sql
SELECT
    id,
    full_name,
    date_of_birth,
    similarity(full_name, $1) AS score
FROM profiles
WHERE full_name % $1
ORDER BY score DESC
LIMIT 20;
```

---

# 12. Relationship Query Examples

## 12.1 Get Father

```sql
SELECT p.*
FROM relationships r
JOIN profiles p ON p.id = r.related_person_id
WHERE r.person_id = $1
  AND r.relationship_type = 'father';
```

## 12.2 Get Mother

```sql
SELECT p.*
FROM relationships r
JOIN profiles p ON p.id = r.related_person_id
WHERE r.person_id = $1
  AND r.relationship_type = 'mother';
```

## 12.3 Get Spouses

For one-row spouse storage:

```sql
SELECT p.*
FROM relationships r
JOIN profiles p
  ON p.id = CASE
      WHEN r.person_id = $1 THEN r.related_person_id
      ELSE r.person_id
  END
WHERE r.relationship_type = 'spouse'
  AND (r.person_id = $1 OR r.related_person_id = $1);
```

## 12.4 Get Children From Father/Mother Links

If parent links are source of truth:

```sql
SELECT child.*
FROM relationships r
JOIN profiles child ON child.id = r.person_id
WHERE r.related_person_id = $1
  AND r.relationship_type IN ('father', 'mother');
```

This gets all profiles where the current profile is listed as father or mother.

---

# 13. Recommended Profile Detail Query Strategy

To build a profile detail page, backend should fetch:

1. Main profile
2. Father
3. Mother
4. Spouse or spouses
5. Children

Example response shape:

```json
{
  "profile": {
    "id": "uuid",
    "full_name": "Alex Carter",
    "date_of_birth": "1997-12-20",
    "date_of_death": null,
    "gender": "male",
    "is_deceased": false
  },
  "relationships": {
    "father": {
      "id": "uuid",
      "full_name": "Jordan Carter"
    },
    "mother": null,
    "spouses": [
      {
        "id": "uuid",
        "full_name": "Example Spouse Name"
      }
    ],
    "children": [
      {
        "id": "uuid",
        "full_name": "Example Child Name"
      }
    ]
  }
}
```

---

# 14. Insert Examples

## 14.1 Create Profile

```sql
INSERT INTO profiles (
    full_name,
    normalized_name,
    date_of_birth,
    gender
)
VALUES (
    'Alex Carter',
    'alex carter',
    '1997-12-20',
    'male'
)
RETURNING *;
```

## 14.2 Link Father

```sql
INSERT INTO relationships (
    person_id,
    related_person_id,
    relationship_type
)
VALUES (
    $1,
    $2,
    'father'
)
RETURNING *;
```

## 14.3 Link Spouse

```sql
INSERT INTO relationships (
    person_id,
    related_person_id,
    relationship_type
)
VALUES (
    $1,
    $2,
    'spouse'
)
RETURNING *;
```

---

# 15. Update Timestamp Trigger

PostgreSQL does not automatically update `updated_at`.

Recommended trigger:

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Apply to profiles:

```sql
CREATE TRIGGER trigger_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
```

---

# 16. Recommended Full MVP Migration

This is a complete starter migration example.

Implementation note:

The current Prisma migration intentionally omits `media` and `media_tags` for the first database foundation milestone. Add those tables later only when media upload or tagging is requested.

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    full_name TEXT NOT NULL,
    normalized_name TEXT,

    date_of_birth DATE,
    date_of_death DATE,

    gender TEXT,
    notes TEXT,

    is_deceased BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT profiles_death_after_birth_check
    CHECK (
        date_of_birth IS NULL
        OR date_of_death IS NULL
        OR date_of_death >= date_of_birth
    )
);

CREATE TABLE relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    person_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    related_person_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    relationship_type TEXT NOT NULL,
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT relationships_no_self_link
    CHECK (person_id <> related_person_id),

    CONSTRAINT relationships_type_check
    CHECK (relationship_type IN ('father', 'mother', 'spouse', 'child')),

    CONSTRAINT relationships_unique_link
    UNIQUE (person_id, related_person_id, relationship_type)
);

CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    file_url TEXT NOT NULL,
    file_name TEXT,
    file_type TEXT,
    file_size_bytes BIGINT,

    uploaded_by UUID,
    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE media_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    face_box JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT media_tags_unique_profile_per_media
    UNIQUE (media_id, profile_id)
);

CREATE INDEX idx_profiles_full_name
ON profiles (full_name);

CREATE INDEX idx_profiles_normalized_name
ON profiles (normalized_name);

CREATE INDEX idx_profiles_date_of_birth
ON profiles (date_of_birth);

CREATE INDEX idx_relationships_person_id
ON relationships (person_id);

CREATE INDEX idx_relationships_related_person_id
ON relationships (related_person_id);

CREATE INDEX idx_relationships_type
ON relationships (relationship_type);

CREATE INDEX idx_relationships_person_type
ON relationships (person_id, relationship_type);

CREATE INDEX idx_relationships_related_type
ON relationships (related_person_id, relationship_type);

CREATE INDEX idx_media_tags_media_id
ON media_tags (media_id);

CREATE INDEX idx_media_tags_profile_id
ON media_tags (profile_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
```

---

# 17. Recommended Seed Data

Seed data should be separate from schema migration.

Example:

```sql
INSERT INTO profiles (
    full_name,
    normalized_name,
    date_of_birth,
    gender
)
VALUES
('Alex Carter', 'alex carter', '1997-12-20', 'male'),
('Jordan Carter', 'jordan carter', NULL, 'male'),
('Example Mother Name', 'example mother name', NULL, 'female');
```

Then link relationship after getting IDs.

For app seed scripts, use variables or query returned IDs instead of hardcoding UUID manually.

---

# 18. API Mapping Suggestion

Database schema should support these API endpoints.

## Profiles

```text
GET    /profiles
GET    /profiles/:id
POST   /profiles
PATCH  /profiles/:id
DELETE /profiles/:id
```

For MVP, delete can be soft-disabled or require confirmation.

## Search

```text
GET /profiles/search?q=car
```

## Duplicate Check

```text
POST /profiles/check-duplicates
```

## Relationships

```text
POST   /relationships
DELETE /relationships/:id
GET    /profiles/:id/relationships
```

---

# 19. Backend Validation Summary

Before creating profile:

- Trim full name
- Reject empty full name
- Normalize name
- Check possible duplicates

Before creating relationship:

- Check person exists
- Check related person exists
- Check relationship type is allowed
- Prevent self-link
- Prevent duplicate link
- Apply father/mother/spouse/child rules

---

# 20. Frontend Data Behaviour

Relationship fields should not be plain text only.

They should behave like searchable selectors.

Example flow:

```text
Father field:
User types "car"
Dropdown shows matching profiles
User selects "Jordan Carter"
Frontend stores selected profile ID
Backend creates relationship using UUID
```

If no match:

```text
Show "Create new profile"
```

---

# 21. Data Integrity Checklist

Before considering the database MVP ready:

- [ ] Profiles table exists.
- [ ] Relationships table exists.
- [ ] UUIDs are used.
- [ ] Relationship foreign keys work.
- [ ] Self-relationship is blocked.
- [ ] Duplicate relationship is blocked.
- [ ] Search works by partial name.
- [ ] Profile detail can fetch father.
- [ ] Profile detail can fetch mother.
- [ ] Profile detail can fetch spouse.
- [ ] Profile detail can fetch children.
- [ ] `updated_at` updates on profile edit.
- [ ] Seed data is separate from migration.
- [ ] No destructive reset is required during normal development.

---

# 22. Important Design Decision

For MVP, the strongest recommended source of truth is:

```text
Child -> father -> Father
Child -> mother -> Mother
```

Children can be derived from reverse lookup.

Spouse can be stored as one row and queried from both directions.

This keeps the database cleaner and reduces duplicate relationship records.

---

# 23. Final Schema Summary

Minimum MVP database:

```text
profiles
relationships
```

Future-ready database:

```text
profiles
relationships
media
media_tags
```

Recommended future database:

```text
profiles
relationships
media
media_tags
profile_change_logs
users
contribution_requests
```

Do not build future tables until needed, unless the user specifically requests future-ready structure.
