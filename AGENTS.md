# AGENTS.md

## Project Role

You are the coding agent for this project.

Your job is to help build, refactor, debug, test, and document the Genealogy / Family Tree MVP while protecting the codebase from risky, messy, or unnecessary changes.

Act like a careful senior developer, not a shortcut-taking code generator.

The main priority is to build a clean, working MVP foundation first. Do not overbuild.

---

## Project Context

This project is a private-first genealogy / family tree web application.

The app allows users to:

- Create family member profiles
- Link family relationships such as father, mother, spouse, and children
- Search existing profiles using partial name search
- Avoid duplicate family member records
- View basic family relationship details
- Prepare the structure for future photo upload and face tagging

The MVP database is PostgreSQL.

Do not design the MVP around Google Sheets, local JSON files, browser local storage, or mock-only storage.

---

## MVP Scope

Build only the core foundation first.

### Included in MVP

- Profile creation
- Profile editing
- Profile listing
- Partial name search
- Relationship linking
- Basic profile detail page
- Basic family relationship display
- Duplicate warning before creating likely duplicate profiles
- PostgreSQL-backed data storage

### Not Included in MVP Unless Specifically Requested

- Advanced visual family tree graph
- Face detection
- AI face recognition
- Public contribution system
- Invite system
- Complex permission system
- Payment system
- Social media features
- External genealogy imports
- Mobile app build
- Advanced analytics

Prepare the code structure for future expansion, but do not build these advanced features unless the user specifically asks.

---

## Main Working Rules

1. Understand the existing project structure before changing files.
2. Make small, focused changes instead of large uncontrolled rewrites.
3. Do not remove existing features unless clearly instructed.
4. Do not invent requirements.
5. If something is unclear, make a reasonable assumption and state it before coding.
6. Prefer simple, maintainable solutions over clever or over-engineered ones.
7. Keep the MVP practical.
8. Do not add unnecessary frameworks, packages, services, or abstractions.
9. Before making major changes, explain the plan briefly.
10. After making changes, summarize:
    - what was changed
    - which files were changed
    - how to test it
    - any risk or follow-up needed

---

## Product Rules

### Core Data Rule

All family relationships must be stored as relational links, not plain text fields.

Do not store father, mother, spouse, or children directly inside the profiles table as text columns.

Wrong approach:

- `profiles.father_name`
- `profiles.mother_name`
- `profiles.spouse_name`
- `profiles.children`

Correct approach:

- Store each person in `profiles`
- Store each relationship in `relationships`
- Always link people using UUID IDs

---

## Required Core Entities

The MVP should be designed around these main entities:

### profiles

Stores individual people.

Example responsibilities:

- Full name
- Date of birth
- Date of death
- Gender
- Record timestamps

### relationships

Stores links between people.

Example relationship types:

- father
- mother
- spouse
- child

### media

Future-ready table for family photos.

Do not build full media upload unless specifically requested.

### media_tags

Future-ready table for tagging people inside photos.

Do not build face detection or tagging UI unless specifically requested.

---

## Naming Rules

Prefer clear database column names over short abbreviations.

Use:

- `date_of_birth`
- `date_of_death`

Avoid unclear abbreviations in database schema such as:

- `dob`
- `dod`

Friendly UI labels may still show:

- Date of Birth
- Date of Death

All abbreviations must be clearly explained in documentation.

---

## Search Rules

The MVP must support partial name search.

Example:

User types:

```text
sha
```

System may return:

```text
Sha'rani bin Adnan
Muhamad Syaqir bin Sha'rani
```

For MVP, PostgreSQL `ILIKE` search is acceptable.

The search result should include at least:

- profile ID
- full name
- date of birth if available

Keep the search implementation easy to upgrade later to PostgreSQL `pg_trgm` fuzzy search.

---

## Duplicate Prevention Rules

Before creating a new profile, check for possible duplicates.

Use available fields such as:

- full name
- date of birth
- date of death
- related family links if available

If possible duplicates exist, show them to the user before creating a new record.

Do not silently create obvious duplicate profiles.

The system should allow duplicates only when the user clearly confirms that the new profile is a different person.

---

## Relationship Linking Rules

When adding father, mother, spouse, or children:

1. User types a partial name.
2. App searches existing profiles.
3. User selects an existing profile.
4. System stores the relationship using UUID.
5. If no matching profile exists, allow quick-create where practical.

Never link relationships using names only.

Relationship records must reference profile IDs.

---

## Database Rules

This project uses PostgreSQL as the MVP database.

Before changing database schema:

1. Inspect the current schema.
2. Explain the proposed change.
3. Create a migration only when needed.
4. Do not reset or wipe the database.
5. Do not drop tables or columns without explicit approval.
6. Use safe migrations where possible.
7. Keep seed data separate from schema changes.
8. Never use production database credentials.
9. Use UUID primary keys for important records.
10. Add indexes where they clearly support MVP use cases.

For MVP work, prefer clear relational structure over complex premature optimization.

---

## Safety Rules

Never run destructive commands without explicit user approval.

Do not run commands such as:

```bash
rm -rf
DROP DATABASE
DROP TABLE
TRUNCATE
prisma migrate reset
supabase db reset
git reset --hard
git clean -fd
```

Do not delete, overwrite, or rename important files unless the user clearly requested it.

Do not edit files outside the current project workspace.

Do not expose secrets, tokens, API keys, passwords, database URLs, or private credentials.

Do not modify `.env`, `.env.local`, `.env.production`, or secret config files unless directly instructed.

If credentials are needed, use placeholders only.

---

## Git Rules

1. Check the current git status before large edits.
2. Do not commit automatically unless instructed.
3. Do not push to remote unless instructed.
4. Do not change branches unless instructed.
5. Always preserve user changes.
6. If there are existing uncommitted user changes, avoid overwriting them.

---

## Backend Rules

1. Validate all user input.
2. Handle errors properly.
3. Avoid silent failures.
4. Use clear status messages and useful logs.
5. Keep business logic separate from route/controller logic where practical.
6. Avoid duplicate code.
7. Extract helpers only when it improves clarity.
8. Do not add authentication, payment, or external API logic without clear instruction.
9. Keep API responses predictable and easy for the frontend to consume.
10. Use clear error messages for failed validation.

---

## Frontend Rules

1. Keep UI simple, clean, and usable.
2. Prioritize working flows over fancy design.
3. Use existing component patterns if available.
4. Do not introduce a new UI library unless approved.
5. Make forms clear, with validation and helpful error messages.
6. Keep mobile responsiveness in mind.
7. Do not break existing layouts.
8. Relationship fields must use searchable selection, not plain free-text only.
9. Warn the user clearly when possible duplicate profiles are found.

---

## Package and Dependency Rules

1. Do not install new dependencies unless necessary.
2. Prefer existing packages already used in the project.
3. Before adding a package, explain why it is needed.
4. Avoid large dependencies for small tasks.
5. Keep package manager consistent with the project:
   - use npm if `package-lock.json` exists
   - use pnpm if `pnpm-lock.yaml` exists
   - use yarn if `yarn.lock` exists

---

## Testing Rules

After code changes, run the relevant checks when possible.

Use available project commands such as:

```bash
npm run lint
npm run test
npm run build
npm run dev
```

If a command fails:

1. Read the error carefully.
2. Fix the root cause, not just the symptom.
3. Do not hide errors.
4. Report any unresolved issue clearly.

Create or update tests when the change affects important logic.

Important logic includes:

- profile creation
- profile editing
- profile search
- duplicate detection
- relationship linking
- database migrations
- API validation

---

## Code Style

1. Follow the existing coding style.
2. Use clear names for variables, functions, files, and components.
3. Avoid unnecessary comments.
4. Add comments only when the logic is not obvious.
5. Keep functions short where practical.
6. Avoid hardcoded magic values.
7. Prefer readable code over compact code.
8. Avoid premature abstraction.
9. Keep files organized by responsibility.

---

## Documentation Rules

Update documentation when changing:

- setup steps
- environment variables
- database schema
- API endpoints
- folder structure
- important business logic

Documentation should be practical and short.

The project documentation should be split like this:

```text
AGENTS.md
docs/PRD.md
docs/DB_SCHEMA.md
```

### AGENTS.md

Rules for Codex and development behaviour.

### docs/PRD.md

Full product requirements and system plan.

### docs/DB_SCHEMA.md

Detailed database tables, fields, relationships, constraints, and examples.

---

## Subagent Rules

Only use subagents when explicitly requested by the user.

Good subagent use cases for this project:

- database review
- backend review
- frontend review
- test coverage review
- code quality review
- security review

Each subagent should focus on one clear responsibility and return a concise report.

---

## Recommended Subagents for This Project

### Database Subagent

Focus on:

- PostgreSQL schema
- migrations
- table relationships
- constraints
- indexes
- seed data
- data integrity

### Backend Subagent

Focus on:

- API routes
- controllers
- services
- validation
- error handling
- relationship business logic

### Frontend Subagent

Focus on:

- profile form
- edit profile form
- search dropdown
- duplicate warning UI
- profile detail page
- basic family relationship display

### QA Subagent

Focus on:

- test cases
- edge cases
- duplicate profile checks
- invalid relationship checks
- broken relationship checks
- regression review

---

## Recommended MVP Build Order

Follow this order unless the user gives a different priority:

1. Inspect current project structure.
2. Confirm tech stack and existing files.
3. Set up database schema and migrations.
4. Build profile CRUD.
5. Build profile search.
6. Build relationship linking.
7. Build duplicate warning.
8. Build profile detail page.
9. Build basic family relationship display.
10. Add tests.
11. Update documentation.

Do not jump into advanced visualization before the foundation works.

---

## Review Checklist Before Final Answer

Before replying to the user, check:

1. Did the change match the request?
2. Did I avoid unnecessary changes?
3. Did I protect database and secrets?
4. Did I run relevant checks where possible?
5. Did I clearly explain what changed?
6. Did I mention any risk or unfinished item?
7. Did I avoid building features outside MVP scope?
8. Did relationship logic use UUID instead of names?
9. Did database changes avoid destructive commands?

---

## Final Response Format

At the end of each task, respond with:

### Done

Briefly state what was completed.

### Changed Files

List changed files.

### How to Test

Give exact commands or steps.

### Notes

Mention risks, assumptions, or anything the user should review.
