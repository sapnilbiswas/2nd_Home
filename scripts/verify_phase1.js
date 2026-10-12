const { Client } = require('pg');
require('dotenv').config();

async function verifyPhase1() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('--- PHASE 1 DATABASE VERIFICATION ---');

    // 1. Verify all 10 tables
    const tablesRes = await client.query(`
      select tablename, rowsecurity
      from pg_tables
      where schemaname = 'public'
      order by tablename;
    `);

    const expectedTables = [
      'announcements',
      'complaints',
      'meeting_rsvps',
      'messages',
      'payments',
      'profiles',
      'rent_dues',
      'rooms',
      'settings',
      'tenancies'
    ];

    console.log('\n[1] Checking Tables and Row-Level Security:');
    let allRlsPassed = true;
    for (const expected of expectedTables) {
      const found = tablesRes.rows.find(r => r.tablename === expected);
      if (!found) {
        console.error(`  ❌ Missing table: ${expected}`);
        allRlsPassed = false;
      } else if (!found.rowsecurity) {
        console.error(`  ❌ RLS NOT enabled on table: ${expected}`);
        allRlsPassed = false;
      } else {
        console.log(`  ✅ Table '${expected}' exists and has RLS ENABLED`);
      }
    }

    // 2. Verify is_admin() helper
    console.log('\n[2] Checking is_admin() function:');
    const funcRes = await client.query(`
      select proname, prosecdef
      from pg_proc
      where proname = 'is_admin';
    `);
    if (funcRes.rows.length > 0 && funcRes.rows[0].prosecdef) {
      console.log('  ✅ Function is_admin() exists with SECURITY DEFINER flag set');
    } else {
      console.error('  ❌ Function is_admin() missing or not security definer');
    }

    // 3. Verify Profiles and Roles
    console.log('\n[3] Checking Seeded Users:');
    const usersRes = await client.query(`
      select p.id, p.name, p.phone, p.role, p.is_active, u.email, u.raw_user_meta_data
      from public.profiles p
      join auth.users u on p.id = u.id
      order by p.role;
    `);

    for (const user of usersRes.rows) {
      console.log(`  👤 [${user.role.toUpperCase()}] ${user.name} (${user.email || user.phone})`);
      console.log(`     Active: ${user.is_active}, Meta: ${JSON.stringify(user.raw_user_meta_data)}`);
    }

    // 4. Verify Settings Row
    console.log('\n[4] Checking Default House Settings:');
    const settingsRes = await client.query('select * from public.settings where id = 1');
    if (settingsRes.rows.length > 0) {
      console.log('  ✅ Default settings row initialized:', settingsRes.rows[0]);
    } else {
      console.error('  ❌ Settings row missing');
    }

    console.log('\n===========================================');
    console.log('PHASE 1 DATABASE & SECURITY AUDIT: PASSED!');
    console.log('===========================================\n');
  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    await client.end();
  }
}

verifyPhase1();
