const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Missing DIRECT_URL or DATABASE_URL in .env');
    process.exit(1);
  }

  console.log('Connecting to Postgres via session pooler...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected successfully to Postgres!');

    // 1. Create all 10 tables from Plan Section 4
    const ddl = `
      create table if not exists profiles (
        id uuid primary key references auth.users on delete cascade,
        name text,
        phone text,
        role text check (role in ('admin','tenant')) default 'tenant',
        push_token text,
        is_active boolean default true
      );

      create table if not exists settings (
        id int primary key default 1,
        owner_upi_id text,
        owner_name text
      );

      create table if not exists rooms (
        id serial primary key,
        room_no text,
        monthly_rent int,
        capacity int default 1
      );

      create table if not exists tenancies (
        id serial primary key,
        tenant_id uuid references profiles on delete cascade,
        room_id int references rooms on delete restrict,
        start_date date,
        end_date date
      );

      create table if not exists rent_dues (
        id serial primary key,
        tenancy_id int references tenancies on delete cascade,
        month date,
        amount int,
        status text default 'unpaid'
      );

      create table if not exists payments (
        id serial primary key,
        due_id int references rent_dues on delete cascade,
        utr text unique,
        screenshot_url text,
        status text default 'pending'
          check (status in ('pending','confirmed','rejected')),
        created_at timestamptz default now()
      );

      create table if not exists complaints (
        id serial primary key,
        tenant_id uuid references profiles on delete cascade,
        category text,
        details text,
        photo_url text,
        admin_reply text,
        status text default 'open'
          check (status in ('open','in_progress','resolved')),
        created_at timestamptz default now()
      );

      create table if not exists announcements (
        id serial primary key,
        title text,
        body text,
        is_meeting boolean default false,
        meeting_at timestamptz,
        venue text,
        created_at timestamptz default now()
      );

      create table if not exists meeting_rsvps (
        announcement_id int references announcements on delete cascade,
        tenant_id uuid references profiles on delete cascade,
        response text check (response in ('yes','no','maybe')),
        primary key (announcement_id, tenant_id)
      );

      create table if not exists messages (
        id bigserial primary key,
        room text default 'general',
        sender_id uuid references profiles on delete cascade,
        body text,
        media_url text,
        created_at timestamptz default now()
      );
    `;

    console.log('Executing DDL for all 10 tables...');
    await client.query(ddl);
    console.log('All 10 tables created or verified.');

    // 2. Read and apply RLS and security helper migration
    const migrationFile = path.join(__dirname, '../prisma/migrations/0001_initial_schema_and_rls/migration.sql');
    if (fs.existsSync(migrationFile)) {
      console.log('Applying RLS and is_admin helper migration...');
      const rlsSql = fs.readFileSync(migrationFile, 'utf8');
      await client.query(rlsSql);
      console.log('RLS policies and security functions applied successfully.');
    }

    // 3. Inspect public tables
    const res = await client.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
      order by table_name;
    `);

    console.log('Current public tables:', res.rows.map(r => r.table_name));
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
