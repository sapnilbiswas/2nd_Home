const { Client } = require('pg');
require('dotenv').config();

async function verifyPhase6() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('--- PHASE 6: REALTIME CHAT VERIFICATION ---');

    // 1. Fetch admin and resident
    const adminRes = await client.query(`
      select id, name, phone from public.profiles where role = 'admin' limit 1;
    `);
    const tenantRes = await client.query(`
      select id, name, phone from public.profiles where role = 'tenant' limit 1;
    `);

    if (adminRes.rows.length === 0 || tenantRes.rows.length === 0) {
      throw new Error('Admin or Tenant profile not found in database');
    }

    const admin = adminRes.rows[0];
    const tenant = tenantRes.rows[0];
    console.log(`\n[1] Found Admin: ${admin.name} (${admin.id})`);
    console.log(`    Found Resident: ${tenant.name} (${tenant.id})`);

    // 2. Test Resident Sending Text in House General Chat
    console.log('\n[2] Testing Resident Sending Message in House General Chat...');
    const generalMsgRes = await client.query(`
      insert into public.messages (room, sender_id, body)
      values ('general', $1, 'Hey everyone! Is anyone cooking dinner tonight in the common kitchen?')
      returning *;
    `, [tenant.id]);
    const msg1 = generalMsgRes.rows[0];
    console.log(`  ✅ General Message Posted: ID #${msg1.id}`);
    console.log(`     Room: ${msg1.room}`);
    console.log(`     Sender ID: ${msg1.sender_id}`);
    console.log(`     Body: "${msg1.body}"`);

    // 3. Test Admin Posting Photo Attachment in House General Chat
    console.log('\n[3] Testing Admin Sending Photo Attachment in General Chat...');
    const photoUrl = 'https://res.cloudinary.com/demo/image/upload/sample_notice_board.jpg';
    const generalPhotoRes = await client.query(`
      insert into public.messages (room, sender_id, body, media_url)
      values ('general', $1, 'Please note the new house rules posted on the board.', $2)
      returning *;
    `, [admin.id, photoUrl]);
    const msg2 = generalPhotoRes.rows[0];
    console.log(`  ✅ Media Message Posted: ID #${msg2.id}`);
    console.log(`     Media URL: ${msg2.media_url}`);

    // 4. Test 1-on-1 Direct Message: Resident -> Admin
    console.log('\n[4] Testing Resident -> Admin Direct Message Thread...');
    const dmRoom = tenant.id; // private room identified by tenant id
    const dmResidentRes = await client.query(`
      insert into public.messages (room, sender_id, body)
      values ($1, $2, 'Hi Admin, I will be returning late from college campus today around 11:30 PM.')
      returning *;
    `, [dmRoom, tenant.id]);
    const dm1 = dmResidentRes.rows[0];
    console.log(`  ✅ Resident DM Sent: ID #${dm1.id}`);
    console.log(`     Thread Room: ${dm1.room}`);
    console.log(`     Body: "${dm1.body}"`);

    // 5. Test 1-on-1 Direct Message: Admin -> Resident Reply
    console.log('\n[5] Testing Admin -> Resident DM Reply...');
    const dmAdminRes = await client.query(`
      insert into public.messages (room, sender_id, body)
      values ($1, $2, 'Noted Rohan. Main gate passcode is active as usual. Travel safe!')
      returning *;
    `, [dmRoom, admin.id]);
    const dm2 = dmAdminRes.rows[0];
    console.log(`  ✅ Admin Reply Sent: ID #${dm2.id}`);
    console.log(`     Thread Room: ${dm2.room}`);
    console.log(`     Body: "${dm2.body}"`);

    // 6. Test Querying Message History Joined With Profiles
    console.log('\n[6] Testing Chat Feed Query with Senders Profile Join...');
    const feedRes = await client.query(`
      select m.id, m.room, m.body, m.media_url, m.created_at, p.name as sender_name, p.role as sender_role
      from public.messages m
      join public.profiles p on m.sender_id = p.id
      where m.room = $1
      order by m.created_at asc;
    `, [dmRoom]);

    console.log(`  ✅ Private Thread Retrieved: ${feedRes.rows.length} message(s)`);
    feedRes.rows.forEach((m, idx) => {
      console.log(`     ${idx + 1}. [${m.sender_role.toUpperCase()}] ${m.sender_name}: "${m.body}"`);
    });

    if (feedRes.rows.length !== 2) {
      throw new Error('Expected 2 messages in private thread');
    }

    // 7. Verify Realtime Publication Contains messages
    console.log('\n[7] Verifying Supabase Realtime Publication Status...');
    const pubRes = await client.query(`
      select tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages';
    `);
    if (pubRes.rows.length > 0) {
      console.log('  ✅ Table "messages" is active in "supabase_realtime" publication');
    } else {
      console.warn('  ⚠️ "messages" not yet listed in publication (will enable)');
      await client.query(`alter publication supabase_realtime add table public.messages;`);
      console.log('  ✅ Added "messages" to publication');
    }

    // 8. Cleanup verification messages
    console.log('\n[8] Cleaning up verification test messages...');
    await client.query('delete from public.messages where id in ($1, $2, $3, $4)', [
      msg1.id,
      msg2.id,
      dm1.id,
      dm2.id,
    ]);
    console.log('  ✅ Verification messages cleanly removed');

    console.log('\n===========================================');
    console.log('PHASE 6: REALTIME CHAT VERIFIED SUCCESSFULLY!');
    console.log('===========================================\n');
  } catch (err) {
    console.error('Phase 6 verification failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyPhase6();
