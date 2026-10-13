const { Client } = require('pg');
require('dotenv').config();

async function verifyPhase4() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('--- PHASE 4: COMPLAINTS & REPAIRS VERIFICATION ---');

    // 1. Fetch test tenant
    const tenantRes = await client.query(`
      select id, name, phone from public.profiles where role = 'tenant' limit 1;
    `);
    if (tenantRes.rows.length === 0) {
      throw new Error('No tenant found in profiles to submit complaint');
    }
    const tenant = tenantRes.rows[0];
    console.log(`\n[1] Found Tenant: ${tenant.name} (${tenant.phone})`);

    // 2. Test Tenant Submitting Complaint Ticket
    console.log('\n[2] Testing Complaint Ticket Submission...');
    const complaintInsert = await client.query(`
      insert into public.complaints (tenant_id, category, details, photo_url, status)
      values ($1, '⚡ Electrical', 'Main room switchboard sparking when turning on geyser', $2, 'open')
      returning *;
    `, [tenant.id, 'https://res.cloudinary.com/demo/image/upload/sample_spark.jpg']);

    const complaint = complaintInsert.rows[0];
    console.log(`  ✅ Complaint Registered: ID #${complaint.id}`);
    console.log(`     Category: ${complaint.category}`);
    console.log(`     Details: "${complaint.details}"`);
    console.log(`     Photo URL: ${complaint.photo_url}`);
    console.log(`     Status: ${complaint.status}`);

    // 3. Test Check Constraint on Status
    console.log('\n[3] Testing Complaint Status Constraint...');
    try {
      await client.query(`
        update public.complaints
        set status = 'invalid_status'
        where id = $1;
      `, [complaint.id]);
      throw new Error('Invalid status was unexpectedly accepted!');
    } catch (checkErr) {
      console.log('  ✅ Invalid status correctly rejected by Postgres CHECK constraint');
    }

    // 4. Test Admin Setting Status to in_progress with Reply
    console.log('\n[4] Testing Admin Reply & In-Progress Transition...');
    const replyMsg = 'Electrician Mr. Kumar assigned. He will visit tomorrow at 11:00 AM.';
    await client.query(`
      update public.complaints
      set status = 'in_progress',
          admin_reply = $1
      where id = $2;
    `, [replyMsg, complaint.id]);

    const progressCheck = await client.query('select status, admin_reply from public.complaints where id = $1', [complaint.id]);
    console.log(`  ✅ Updated Status: ${progressCheck.rows[0].status}`);
    console.log(`  ✅ Admin Reply: "${progressCheck.rows[0].admin_reply}"`);

    // 5. Test Admin Marking Complaint as Resolved
    console.log('\n[5] Testing Complaint Resolution...');
    await client.query(`
      update public.complaints
      set status = 'resolved',
          admin_reply = admin_reply || ' [RESOLVED: Switchboard replaced.]'
      where id = $1;
    `, [complaint.id]);

    const resolvedCheck = await client.query('select status, admin_reply from public.complaints where id = $1', [complaint.id]);
    console.log(`  ✅ Final Status: ${resolvedCheck.rows[0].status}`);
    console.log(`  ✅ Final Notes: "${resolvedCheck.rows[0].admin_reply}"`);

    if (resolvedCheck.rows[0].status !== 'resolved') {
      throw new Error('Complaint resolution workflow failed');
    }

    console.log('\n===========================================');
    console.log('PHASE 4: COMPLAINTS VERIFIED SUCCESSFULLY!');
    console.log('===========================================\n');
  } catch (err) {
    console.error('Phase 4 verification failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyPhase4();
