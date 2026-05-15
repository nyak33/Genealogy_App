# Genealogy App

A private-first genealogy and family tree MVP built with Next.js, TypeScript, PostgreSQL, Prisma, and Tailwind CSS.

The goal of this MVP is to provide a clean foundation for recording family member profiles, preventing duplicate records, searching existing profiles, and linking immediate family relationships using database IDs instead of plain text names.

## Features

- Create, list, view, and edit profile records
- Store profiles in PostgreSQL with UUID primary keys
- Generate `normalizedName` automatically for search and duplicate checks
- Search profiles by partial name
- Warn before creating likely duplicate profiles
- Link father, mother, spouse, and child relationships
- Display father, mother, spouses, and children on profile detail pages
- View a simple profile-centered family tree
- Block self-links, duplicate relationships, reverse spouse duplicates, multiple fathers, and multiple mothers
- Review data quality with duplicate groups, relationship conflicts, and missing-info reports
- Protect public deployments with a simple private access password
- Seed safe fake local sample data

## Tech Stack

- Next.js App Router
- TypeScript
- PostgreSQL
- Prisma 7
- Tailwind CSS
- Zod

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
copy .env.example .env
```

Update `.env` with your local PostgreSQL connection string:

```text
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/genealogy_mvp?schema=public"
```

For any public deployment that contains real family data, set a strong private
access password in the hosting environment:

```text
APP_ACCESS_PASSWORD="use-a-long-random-password"
```

When `APP_ACCESS_PASSWORD` is set, all pages and API routes require the
password before profile data can be viewed or changed. In production, the app
fails closed if `APP_ACCESS_PASSWORD` is missing.

Run the Prisma migration:

```bash
npm.cmd run prisma:migrate
```

Seed local sample data:

```bash
npm.cmd run prisma:seed
```

Run tests:

```bash
npm.cmd run test
```

Start the development server:

```bash
npm.cmd run dev
```

Open:

```text
http://localhost:3000
```

## Useful Scripts

```bash
npm.cmd run dev
npm.cmd run lint
npm.cmd run build
npm.cmd run test
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run prisma:seed
```

## Database Notes

The MVP database uses two core tables:

- `profiles`
- `relationships`

Relationship records link profiles by UUID. The app does not store father, mother, spouse, or children as plain text fields on the profile record.

For MVP relationship logic:

- Father is stored as `Child -> father -> Father`
- Mother is stored as `Child -> mother -> Mother`
- Children are derived by reverse lookup from father and mother links
- Spouse is stored as one row and displayed bidirectionally

See [docs/DB_SCHEMA.md](docs/DB_SCHEMA.md) for schema details.

## Data Quality

Open `/data-quality` in the app to review:

- Possible duplicate profiles grouped by `normalizedName`
- Relationship conflicts from old or invalid rows
- Profiles missing date of birth, gender, father, or mother

The dashboard only provides safe fix tools: open profile pages, edit profile details, and remove incorrect relationship links. It does not auto-merge profiles or hard delete profile records.

## Safety Notes

Do not commit `.env` or real database credentials.

Do not deploy real family data publicly without setting `APP_ACCESS_PASSWORD`.
This private access gate is only a lightweight MVP protection layer, not a full
multi-user account or permission system.

Do not run destructive database commands unless you explicitly intend to wipe local data. In particular, avoid:

```bash
prisma migrate reset
```

Use normal migration and seed commands during development.

## Testing Notes

The checked-in tests focus on validation and service logic that can run without a database. They cover name normalization, profile validation, relationship validation, search query behavior, duplicate-check query behavior, relationship conflict rules, spouse bidirectional display mapping, child display from reverse parent lookup, and data quality report helpers.

Manual database QA is still recommended after migrations and seed data are applied locally:

- Create and edit a profile
- Confirm `updatedAt` changes after edit
- Search by partial name and verify empty search returns no records
- Trigger duplicate warning and confirm creating a different person
- Add father, mother, spouse, and child relationships
- Confirm spouse displays from both profiles
- Confirm children display from reverse father/mother lookup
- Open a profile tree view and confirm parents, spouses, and children display
- Confirm self-link, duplicate, conflicting relationship, and reverse spouse duplicate attempts fail
- Delete a relationship and confirm profile records remain
- Review `/data-quality` for duplicate groups, conflicts, and missing-info reports

## MVP Scope

Included:

- Profile CRUD
- Profile search
- Duplicate warning
- Relationship linking
- Basic family relationship display
- Simple profile-centered tree view
- PostgreSQL-backed storage
- Lightweight private access gate for public deployments

Not included yet:

- Full user accounts or role-based authentication
- Advanced graph-style tree visualization
- Media upload
- Face tagging
- Invites or permissions
- Payments
- Analytics

## Documentation

- [AGENTS.md](AGENTS.md)
- [docs/PRD.md](docs/PRD.md)
- [docs/DB_SCHEMA.md](docs/DB_SCHEMA.md)
