# PRD.md

# Genealogy / Family Tree App MVP  
## Product Requirements Document

---

## 1. Product Summary

This project is a private-first genealogy / family tree web application.

The first MVP goal is to create a structured database system where family member profiles can be created, searched, linked, and viewed clearly.

The system should not only store names. It must store people as unique records and store family relationships as links between records.

The MVP will use PostgreSQL as the main database.

---

## 2. Product Vision

The long-term vision is to build a genealogy platform where users can privately preserve their family records, relationships, photos, and historical memory.

The system should eventually support:

- Family member profiles
- Family relationship mapping
- Family tree visualization
- Photo storage
- Face tagging
- Family member contribution
- Approval workflow for submitted edits
- Controlled sharing between family groups

The MVP should focus only on the core foundation:

- Profile records
- Relationship records
- Search
- Duplicate prevention
- Basic family display

---

## 3. Main Objective

Build a working MVP that allows the user to:

1. Create a person profile.
2. Edit a person profile.
3. Search existing profiles by partial name.
4. Link father, mother, spouse, and children using existing profile records.
5. Quickly create a new profile if the person does not exist yet.
6. Avoid duplicate person profiles where possible.
7. View a person profile with linked family relationships.

---

## 4. Problem Statement

Family records are often scattered across memory, WhatsApp chats, old documents, photos, and verbal stories.

Existing public genealogy platforms may not be suitable when the user wants privacy and full control over family data.

A simple manual family tree is also not enough because:

- Names can be duplicated.
- Relationships can become inconsistent.
- People may have incomplete information.
- Photos need to be linked to real people.
- Family members may later need to contribute corrections.

The MVP solves the first layer of this problem by building a proper structured database for family profiles and relationships.

---

## 5. Target Users

### Primary User

The main user who owns and manages the family database.

Responsibilities:

- Add family profiles
- Link family members
- Correct errors
- Approve future contributions

### Future Secondary Users

Family members who may contribute information later.

Possible responsibilities:

- Suggest new profiles
- Suggest relationship edits
- Upload photos
- Tag people in photos
- Add missing birth or death details

For MVP, multi-user contribution is not required yet.

---

## 6. MVP Scope

### Included in MVP

The MVP must include:

1. Profile creation
2. Profile editing
3. Profile listing
4. Partial profile search
5. Relationship linking
6. Duplicate profile warning
7. Basic person detail page
8. Basic family relationship display
9. PostgreSQL database
10. UUID-based records
11. Lightweight private access gate for public deployments

---

## 7. Out of Scope for MVP

The following features are not part of the first MVP unless specifically requested later:

- Advanced visual family tree graph
- Face detection
- AI face recognition
- Photo upload UI
- Public user registration
- Family member invite system
- Role-based permission system
- Edit approval workflow
- Mobile app
- Payment system
- External genealogy import
- DNA-related features
- Advanced analytics
- Timeline visualization

The database may prepare for some future features, but the UI and logic should not be overbuilt in MVP.

---

## 8. Core Product Principles

### 8.1 Private First

The system should be designed with the assumption that family data is sensitive.

The MVP may use a lightweight private access password for public deployments so
profile data is not exposed to the open internet. This is not a replacement for
future user accounts, invite flows, or role-based permissions.

Even if full authentication is not included in the first MVP, the codebase should not expose data unnecessarily.

### 8.2 Relationship First

The system must treat family relationships as structured links, not text.

Wrong approach:

```text
father_name = "Jordan Carter"
```

Correct approach:

```text
person_id -> relationship_type -> related_person_id
```

Example:

```text
Alex Carter -> father -> Jordan Carter
```

### 8.3 Search Before Create

Before creating a new profile, the system should help the user search existing profiles.

This reduces duplicate records.

### 8.4 Simple First

The MVP should be boring but reliable.

Do not prioritize beautiful tree visualization before profile and relationship data is clean.

---

## 9. Main User Flow

## 9.1 Create New Profile

### User Story

As a user, I want to create a new family member profile so that I can start recording family information.

### Form Fields

Required:

- Full name

Optional:

- Date of birth
- Date of death
- Gender
- Notes

### Expected Flow

1. User opens "Add Profile".
2. User enters full name.
3. System checks for possible duplicates.
4. If duplicates are found, system shows matching profiles.
5. User can choose existing profile or continue creating a new one.
6. User fills optional details.
7. User saves profile.
8. System creates a new profile record with UUID.

### Acceptance Criteria

- User can create a profile with full name only.
- User can optionally add date of birth and date of death.
- System saves the profile in PostgreSQL.
- System generates a UUID for the profile.
- System warns if possible duplicates exist.
- System does not silently create obvious duplicate records.

---

## 9.2 Edit Existing Profile

### User Story

As a user, I want to edit a profile so that I can update missing or incorrect information.

### Editable Fields

- Full name
- Date of birth
- Date of death
- Gender
- Notes

### Expected Flow

1. User opens a profile detail page.
2. User clicks edit.
3. User updates fields.
4. User saves changes.
5. System updates the profile record.

### Acceptance Criteria

- User can update profile details.
- System validates input.
- System updates `updated_at`.
- System does not change relationship records unless explicitly edited.

---

## 9.3 Partial Name Search

### User Story

As a user, I want to search by partial name so that I can quickly find existing family members.

### Example

User types:

```text
car
```

System may show:

```text
Jordan Carter
Alex Carter
Maya Carter
```

### Search Result Should Show

- Full name
- Date of birth if available
- Profile ID internally
- Short relationship context if available later

### MVP Search Logic

Use PostgreSQL partial matching:

```sql
ILIKE '%search_term%'
```

### Future Upgrade

Later, search can be upgraded using PostgreSQL `pg_trgm` for fuzzy search.

### Acceptance Criteria

- Search works with partial names.
- Search is case-insensitive.
- Search returns relevant profiles.
- Empty search should not return unlimited records unless intentionally designed.
- Search response should include profile ID.

---

## 9.4 Link Father

### User Story

As a user, I want to link a father to a profile so that the family relationship is properly recorded.

### Expected Flow

1. User opens a profile.
2. User clicks add father.
3. User types partial name.
4. System shows matching existing profiles.
5. User selects the father profile.
6. System creates a relationship record.

### Relationship Example

```text
Child profile -> father -> Father profile
```

### Acceptance Criteria

- Father is linked using UUID, not name text.
- Only one biological father should normally be linked unless future relationship type supports adoptive/step relationships.
- System should prevent linking a person as their own father.
- System should prevent obvious circular logic where possible.

---

## 9.5 Link Mother

### User Story

As a user, I want to link a mother to a profile so that the family relationship is properly recorded.

### Expected Flow

Same as father linking.

### Relationship Example

```text
Child profile -> mother -> Mother profile
```

### Acceptance Criteria

- Mother is linked using UUID.
- System should prevent self-linking.
- System should prevent obvious duplicate mother relationship.

---

## 9.6 Link Spouse

### User Story

As a user, I want to link a spouse to a profile so that marriage or partner relationships can be recorded.

### Expected Flow

1. User opens a profile.
2. User clicks add spouse.
3. User searches existing profile.
4. User selects spouse.
5. System creates relationship record.

### Relationship Example

```text
Person A -> spouse -> Person B
```

### Important Behaviour

Spouse relationship should ideally be treated as bidirectional.

If the system stores only one direction, the backend should still display the relationship correctly from both sides.

### Acceptance Criteria

- Spouse is linked using UUID.
- System prevents self-linking.
- System prevents exact duplicate spouse relationship.
- Profile A should show Profile B as spouse.
- Profile B should also show Profile A as spouse.

---

## 9.7 Link Children

### User Story

As a user, I want to link children to a profile so that descendants can be recorded.

### Expected Flow

1. User opens parent profile.
2. User clicks add child.
3. User searches existing profile.
4. User selects child.
5. System creates relationship record.

### Relationship Example

```text
Parent profile -> child -> Child profile
```

### Important Behaviour

If a child relationship is created, the system may also infer parent view later.

For MVP, relationship display must be consistent and understandable.

### Acceptance Criteria

- Child is linked using UUID.
- System prevents self-linking.
- System prevents duplicate child relationship.
- One parent can have many children.

---

## 9.8 Quick Create From Relationship Field

### User Story

As a user, I want to quickly create a missing person while linking relationships so that data entry is faster.

### Example

When adding father:

1. User types "Jordan Carter".
2. No result is found.
3. User clicks "Create new profile".
4. System creates a minimal profile.
5. System links the new profile as father.

### Minimum Quick Create Fields

- Full name

Optional:

- Date of birth
- Date of death
- Gender

### Acceptance Criteria

- User can create a minimal profile from relationship field.
- New profile receives UUID.
- Relationship is linked after creation.
- Duplicate warning still applies before creating.

---

## 10. Profile Detail Page

### Purpose

Show one person's information and immediate family links.

### Required Display

Profile section:

- Full name
- Date of birth
- Date of death
- Gender
- Notes if available

Family relationship section:

- Father
- Mother
- Spouse or spouses
- Children

### Acceptance Criteria

- Profile page loads from database.
- Linked family members are clickable.
- Missing relationships show empty state clearly.
- User can add or edit relationships from this page.

---

## 11. Profile List Page

### Purpose

Show existing profiles and allow basic navigation.

### Required Display

- Full name
- Date of birth if available
- Date of death if available
- Created date if useful

### Required Actions

- Search profile
- Open profile
- Add new profile

### Acceptance Criteria

- User can see existing profiles.
- User can search profiles.
- User can navigate to profile detail.

---

## 12. Duplicate Detection

### Purpose

Prevent messy data early.

Duplicate records are the biggest risk in a genealogy system.

### MVP Duplicate Logic

When creating a profile, check for possible matches using:

- Similar or same full name
- Same date of birth if provided
- Same date of death if provided

### Example Warning

```text
Possible duplicate profiles found:

1. Jordan Carter
   Date of Birth: 1965-02-10

Do you want to use this existing profile instead?
```

### Acceptance Criteria

- System warns before creating likely duplicate.
- User can select existing profile.
- User can still continue if it is genuinely a different person.
- Duplicate detection should not block all creation blindly.

---

## 13. Data Model Summary

The MVP should use these core tables:

1. `profiles`
2. `relationships`

Future-ready tables:

3. `media`
4. `media_tags`

Full database details should be documented in:

```text
docs/DB_SCHEMA.md
```

---

## 14. Relationship Types

### MVP Relationship Types

Allowed types:

- father
- mother
- spouse
- child

### Future Relationship Types

Possible future types:

- adopted_father
- adopted_mother
- step_father
- step_mother
- ex_spouse
- sibling
- guardian
- grandfather
- grandmother

Do not build these future types in MVP unless specifically requested.

---

## 15. Validation Rules

### Profile Validation

Required:

- full_name must not be empty

Optional validation:

- date_of_birth must be a valid date
- date_of_death must be a valid date
- date_of_death should not be earlier than date_of_birth
- gender should use controlled values if implemented

### Relationship Validation

Required:

- person_id must exist
- related_person_id must exist
- relationship_type must be allowed
- person_id must not equal related_person_id

Recommended:

- Prevent duplicate relationship rows
- Prevent more than one father unless future relationship categories support it
- Prevent more than one mother unless future relationship categories support it

---

## 16. Non-Functional Requirements

## 16.1 Performance

MVP does not need advanced optimization.

However:

- Profile search should be fast enough for normal family database size.
- Add indexes for common search and relationship lookups.
- Avoid loading all profiles unnecessarily.

## 16.2 Maintainability

Code should be:

- Modular
- Readable
- Easy to debug
- Easy to extend later

## 16.3 Data Safety

Do not include destructive database operations in normal development flow.

Avoid:

- Dropping database
- Resetting database
- Hard deleting important records without confirmation

## 16.4 Privacy

Family data is sensitive.

Avoid logging full sensitive data unnecessarily.

Do not expose database credentials.

---

## 17. Future Feature Plan

## Phase 1: MVP Foundation

- PostgreSQL schema
- Profile CRUD
- Search
- Relationship linking
- Basic profile detail page

## Phase 2: Better Relationship Experience

- Family tree visual layout
- Relationship conflict detection
- Sibling inference
- Parent-child auto-display
- Relationship notes

## Phase 3: Media and Memories

- Photo upload
- Manual photo tagging
- Media gallery per profile
- Family album view

## Phase 4: Face Tagging

- Face box selection
- Manual face assignment
- Later AI-assisted face detection

## Phase 5: Collaboration

- User accounts
- Invite family members
- Suggested edits
- Approval workflow
- Change history

## Phase 6: Advanced Genealogy

- Source documents
- Birth certificate attachments
- Marriage records
- Family branches
- Export function
- Import function

---

## 18. MVP Success Criteria

The MVP is considered successful when:

1. User can create a profile.
2. User can search existing profiles.
3. User can link father, mother, spouse, and children.
4. User can view a profile with linked relationships.
5. Relationships are stored using UUIDs, not text names.
6. Duplicate warning works before creating a likely duplicate profile.
7. Data is stored in PostgreSQL.
8. Codebase is clean enough to extend later.

---

## 19. Key Risks

### Risk 1: Duplicate Profiles

If duplicate records become common, the family tree will become unreliable.

Mitigation:

- Search before create
- Duplicate warning
- Clear profile detail view

### Risk 2: Bad Relationship Logic

If relationships are stored wrongly, the system will be hard to fix later.

Mitigation:

- Use relationships table
- Link by UUID
- Add validation

### Risk 3: Overbuilding Too Early

Advanced tree visualization can distract from the core database.

Mitigation:

- Build boring foundation first
- Delay advanced visualization

### Risk 4: User Data Entry Burden

If adding family members is slow, users will stop using the system.

Mitigation:

- Partial search
- Quick create
- Simple form
- Minimal required fields

---

## 20. Recommended Build Order

1. Confirm project stack and folder structure.
2. Create PostgreSQL database schema.
3. Create migrations for core tables.
4. Build profile creation API.
5. Build profile edit API.
6. Build profile list API.
7. Build profile search API.
8. Build duplicate check logic.
9. Build relationship linking API.
10. Build frontend profile form.
11. Build frontend search dropdown.
12. Build profile detail page.
13. Display father, mother, spouse, and children.
14. Add tests for profile and relationship logic.
15. Update documentation.

---

## 21. Codex Build Instruction

When using Codex, do not ask it to build the full app in one prompt.

Use task-based prompts.

Example:

```text
Read AGENTS.md and docs/PRD.md first.

Task:
Create the profile CRUD API using the existing PostgreSQL setup.

Before editing files:
1. Inspect the project structure.
2. Explain the files you will modify.
3. Confirm the current database/migration approach.

Do not add advanced family tree visualization.
```

---

## 22. Final MVP Definition

The MVP is not a complete genealogy platform yet.

The MVP is the foundation layer:

```text
People + Relationships + Search + Duplicate Control
```

Once this is stable, visual tree, photos, face tagging, and family contribution can be built safely on top of it.
