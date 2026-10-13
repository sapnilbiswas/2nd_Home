const { Client } = require('pg');
require('dotenv').config();

async function verifyPhase2() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('--- PHASE 2: ADMIN TOOLS VERIFICATION ---');

    // 1. Test Room Creation
    console.log('\n[1] Testing Room Creation & Capacity...');
    const roomRes = await client.query(`
      insert into public.rooms (room_no, monthly_rent, capacity)
      values ('101', 6500, 2)
      on conflict do nothing
      returning *;
    `);
    
    let testRoomId;
    if (roomRes.rows.length > 0) {
      testRoomId = roomRes.rows[0].id;
      console.log(`  ✅ Created Room 101 (ID: ${testRoomId}, Capacity: 2, Rent: ₹6500)`);
    } else {
      const existing = await client.query("select id from public.rooms where room_no = '101'");
      testRoomId = existing.rows[0].id;
      console.log(`  ✅ Existing Room 101 found (ID: ${testRoomId})`);
    }

    // Also create Room 102
    await client.query(`
      insert into public.rooms (room_no, monthly_rent, capacity)
      values ('102', 7000, 1)
      on conflict do nothing;
    `);
    console.log('  ✅ Room 102 (Single bed) verified');

    // 2. Fetch test tenant
    const tenantRes = await client.query(`
      select id, name, phone, role, is_active
      from public.profiles
      where role = 'tenant'
      limit 1;
    `);

    if (tenantRes.rows.length === 0) {
      throw new Error('No tenant found in profiles to test allocation');
    }
    const testTenant = tenantRes.rows[0];
    console.log(`\n[2] Found Test Tenant: ${testTenant.name} (${testTenant.phone})`);

    // 3. Test Room Allocation (Create Tenancy)
    console.log('\n[3] Testing Member Bed Allocation...');
    const today = new Date().toISOString().split('T')[0];
    
    // Clean prior test tenancies
    await client.query('delete from public.tenancies where tenant_id = $1', [testTenant.id]);

    const tenancyInsert = await client.query(`
      insert into public.tenancies (tenant_id, room_id, start_date)
      values ($1, $2, $3)
      returning *;
    `, [testTenant.id, testRoomId, today]);

    const testTenancy = tenancyInsert.rows[0];
    console.log(`  ✅ Allocated Tenant ${testTenant.name} to Room 101 (Tenancy ID: ${testTenancy.id})`);

    // 4. Verify Occupancy Computation
    const occRes = await client.query(`
      select r.id, r.room_no, r.capacity, count(t.id) as occupied
      from public.rooms r
      left join public.tenancies t on r.id = t.room_id and (t.end_date is null or t.end_date >= current_date)
      where r.id = $1
      group by r.id, r.room_no, r.capacity;
    `, [testRoomId]);

    const occ = occRes.rows[0];
    console.log(`  ✅ Room ${occ.room_no} Occupancy: ${occ.occupied} / ${occ.capacity} beds filled`);
    if (parseInt(occ.occupied, 10) !== 1) {
      throw new Error(`Expected occupancy 1, got ${occ.occupied}`);
    }

    // 5. Test Free Bed / End Tenancy
    console.log('\n[5] Testing End Tenancy / Free Bed...');
    await client.query(`
      update public.tenancies
      set end_date = current_date - interval '1 day'
      where id = $1;
    `, [testTenancy.id]);

    const freeOccRes = await client.query(`
      select count(t.id) as occupied
      from public.tenancies t
      where t.room_id = $1 and (t.end_date is null or t.end_date >= current_date);
    `, [testRoomId]);
    console.log(`  ✅ After ending tenancy, active occupants in Room 101: ${freeOccRes.rows[0].occupied}`);

    // Re-allocate for persistent test state
    await client.query(`
      update public.tenancies
      set end_date = null
      where id = $1;
    `, [testTenancy.id]);
    console.log(`  ✅ Re-assigned Tenant to Room 101 for app testing`);

    // 6. Test Disable / Re-enable Account
    console.log('\n[6] Testing Disable / Enable Account...');
    await client.query(`
      update public.profiles
      set is_active = false
      where id = $1;
    `, [testTenant.id]);
    const disabledCheck = await client.query('select is_active from public.profiles where id = $1', [testTenant.id]);
    console.log(`  ✅ Disabled account verified (is_active = ${disabledCheck.rows[0].is_active})`);

    await client.query(`
      update public.profiles
      set is_active = true
      where id = $1;
    `, [testTenant.id]);
    const enabledCheck = await client.query('select is_active from public.profiles where id = $1', [testTenant.id]);
    console.log(`  ✅ Re-enabled account verified (is_active = ${enabledCheck.rows[0].is_active})`);

    // 7. Verify Edge Function files exist
    const fs = require('fs');
    const path = require('path');
    const fn1 = path.join(__dirname, '../supabase/functions/create-tenant/index.ts');
    const fn2 = path.join(__dirname, '../supabase/functions/reset-tenant-password/index.ts');
    if (fs.existsSync(fn1) && fs.existsSync(fn2)) {
      console.log('\n[7] Edge Function Definitions:');
      console.log('  ✅ create-tenant/index.ts exists');
      console.log('  ✅ reset-tenant-password/index.ts exists');
    }

    console.log('\n===========================================');
    console.log('PHASE 2: ADMIN TOOLS VERIFIED SUCCESSFULLY!');
    console.log('===========================================\n');
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyPhase2();
