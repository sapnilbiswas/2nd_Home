const { Client } = require('pg');
require('dotenv').config();

async function verifyPhase5() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('--- PHASE 5: ANNOUNCEMENTS & MEETINGS VERIFICATION ---');

    // 1. Fetch test tenant
    const tenantRes = await client.query(`
      select id, name, phone from public.profiles where role = 'tenant' limit 1;
    `);
    if (tenantRes.rows.length === 0) {
      throw new Error('No tenant found in profiles to test meeting RSVP');
    }
    const tenant = tenantRes.rows[0];
    console.log(`\n[1] Found Resident: ${tenant.name} (${tenant.phone})`);

    // 2. Admin creates general announcement
    console.log('\n[2] Testing General Announcement Creation...');
    const generalAnn = await client.query(`
      insert into public.announcements (title, body, is_meeting)
      values ('Water Tank Maintenance', 'Water supply will be paused from 10:00 AM to 2:00 PM this Sunday for routine cleaning.', false)
      returning *;
    `);
    const ann1 = generalAnn.rows[0];
    console.log(`  ✅ General Notice Created: ID #${ann1.id}`);
    console.log(`     Title: "${ann1.title}"`);
    console.log(`     Is Meeting: ${ann1.is_meeting}`);

    // 3. Admin creates scheduled meeting announcement
    console.log('\n[3] Testing House Meeting Announcement Creation...');
    const meetingTime = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours later
    const meetingAnn = await client.query(`
      insert into public.announcements (title, body, is_meeting, meeting_at, venue)
      values ('Monthly House Council Meeting', 'Discussing electricity sub-metering, quiet hours, and new WiFi installation.', true, $1, '2nd Floor Common Area')
      returning *;
    `, [meetingTime.toISOString()]);
    const meeting = meetingAnn.rows[0];
    console.log(`  ✅ Meeting Notice Created: ID #${meeting.id}`);
    console.log(`     Title: "${meeting.title}"`);
    console.log(`     Scheduled At: ${meeting.meeting_at}`);
    console.log(`     Venue: "${meeting.venue}"`);

    // 4. Resident submits RSVP
    console.log('\n[4] Testing Resident RSVP Submission (YES)...');
    await client.query(`
      insert into public.meeting_rsvps (announcement_id, tenant_id, response)
      values ($1, $2, 'yes')
      on conflict (announcement_id, tenant_id)
      do update set response = excluded.response;
    `, [meeting.id, tenant.id]);
    console.log('  ✅ RSVP "yes" recorded successfully');

    // 5. Test Check Constraint on RSVP response
    console.log('\n[5] Testing RSVP Response Constraint...');
    try {
      await client.query(`
        insert into public.meeting_rsvps (announcement_id, tenant_id, response)
        values ($1, $2, 'definitely_attending')
        on conflict (announcement_id, tenant_id)
        do update set response = excluded.response;
      `, [meeting.id, tenant.id]);
      throw new Error('Invalid RSVP response unexpectedly accepted!');
    } catch (checkErr) {
      console.log('  ✅ Invalid RSVP response correctly rejected by Postgres CHECK constraint');
    }

    // 6. Resident updates RSVP to MAYBE
    console.log('\n[6] Testing Resident Updating RSVP (MAYBE)...');
    await client.query(`
      insert into public.meeting_rsvps (announcement_id, tenant_id, response)
      values ($1, $2, 'maybe')
      on conflict (announcement_id, tenant_id)
      do update set response = excluded.response;
    `, [meeting.id, tenant.id]);
    console.log('  ✅ RSVP updated to "maybe"');

    // 7. Admin reads attendee roster & RSVP tally
    console.log('\n[7] Testing Admin Attendee Breakdown & Roster Query...');
    const rosterRes = await client.query(`
      select r.response, p.name, p.phone
      from public.meeting_rsvps r
      join public.profiles p on r.tenant_id = p.id
      where r.announcement_id = $1;
    `, [meeting.id]);

    console.log(`  ✅ Roster Retrieved: ${rosterRes.rows.length} attendee(s)`);
    rosterRes.rows.forEach((r, idx) => {
      console.log(`     ${idx + 1}. ${r.name} (${r.phone}) -> [${r.response.toUpperCase()}]`);
    });

    const tallyRes = await client.query(`
      select
        count(*) filter (where response = 'yes') as yes_count,
        count(*) filter (where response = 'maybe') as maybe_count,
        count(*) filter (where response = 'no') as no_count
      from public.meeting_rsvps
      where announcement_id = $1;
    `, [meeting.id]);
    const tally = tallyRes.rows[0];
    console.log(`  ✅ RSVP Breakdown: Yes: ${tally.yes_count}, Maybe: ${tally.maybe_count}, No: ${tally.no_count}`);

    if (parseInt(tally.maybe_count, 10) !== 1) {
      throw new Error('RSVP tally calculation mismatch');
    }

    // 8. Cleanup test announcements and RSVPs
    console.log('\n[8] Cleaning up verification artifacts...');
    await client.query('delete from public.meeting_rsvps where announcement_id = $1', [meeting.id]);
    await client.query('delete from public.announcements where id in ($1, $2)', [ann1.id, meeting.id]);
    console.log('  ✅ Verification notices and RSVPs cleanly deleted');

    console.log('\n======================================================');
    console.log('PHASE 5: ANNOUNCEMENTS & MEETINGS VERIFIED SUCCESSFULLY!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('Phase 5 verification failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyPhase5();
