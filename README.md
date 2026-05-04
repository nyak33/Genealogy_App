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
- Block self-links, duplicate relationships, reverse spouse duplicates, multiple fathers, and multiple mothers
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

## Safety Notes

Do not commit `.env` or real database credentials.

Do not run destructive database commands unless you explicitly intend to wipe local data. In particular, avoid:

```bash
prisma migrate reset
```

Use normal migration and seed commands during development.

## Testing Notes

The checked-in tests focus on validation and service logic that can run without a database. They cover name normalization, profile validation, relationship validation, search query behavior, duplicate-check query behavior, relationship conflict rules, spouse bidirectional display mapping, and child display from reverse parent lookup.

Manual database QA is still recommended after migrations and seed data are applied locally:

- Create and edit a profile
- Confirm `updatedAt` changes after edit
- Search by partial name and verify empty search returns no records
- Trigger duplicate warning and confirm creating a different person
- Add father, mother, spouse, and child relationships
- Confirm spouse displays from both profiles
- Confirm children display from reverse father/mother lookup
- Confirm self-link, duplicate, conflicting relationship, and reverse spouse duplicate attempts fail
- Delete a relationship and confirm profile records remain

## MVP Scope

Included:

- Profile CRUD
- Profile search
- Duplicate warning
- Relationship linking
- Basic family relationship display
- PostgreSQL-backed storage

Not included yet:

- Authentication
- Advanced tree visualization
- Media upload
- Face tagging
- Invites or permissions
- Payments
- Analytics

## Documentation

- [AGENTS.md](AGENTS.md)
- [docs/PRD.md](docs/PRD.md)
- [docs/DB_SCHEMA.md](docs/DB_SCHEMA.md)
