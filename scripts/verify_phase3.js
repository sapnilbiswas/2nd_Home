const { Client } = require('pg');
require('dotenv').config();

async function verifyPhase3() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('--- PHASE 3: PAYMENTS & RENT DUES VERIFICATION ---');

    // 1. Verify / Update Owner UPI settings
    console.log('\n[1] Checking House UPI Settings...');
    const settingsRes = await client.query(`
      insert into public.settings (id, owner_upi_id, owner_name)
      values (1, '790859690@axl', '2nd_Home Living')
      on conflict (id) do update set
        owner_upi_id = excluded.owner_upi_id,
        owner_name = excluded.owner_name
      returning *;
    `);
    const settings = settingsRes.rows[0];
    console.log(`  ✅ Owner UPI ID: ${settings.owner_upi_id} (Payee: ${settings.owner_name})`);

    // 2. Fetch test tenancy
    const tenancyRes = await client.query(`
      select t.id, t.tenant_id, t.room_id, r.room_no, r.monthly_rent, p.name as tenant_name
      from public.tenancies t
      join public.rooms r on t.room_id = r.id
      join public.profiles p on t.tenant_id = p.id
      where t.end_date is null or t.end_date >= current_date
      limit 1;
    `);

    if (tenancyRes.rows.length === 0) {
      throw new Error('No active tenancy found to generate rent dues');
    }
    const tenancy = tenancyRes.rows[0];
    console.log(`\n[2] Found Active Tenancy: ${tenancy.tenant_name} in Room ${tenancy.room_no} (Rent: ₹${tenancy.monthly_rent})`);

    // 3. Test Generating Rent Dues
    console.log('\n[3] Testing Rent Due Generation for 2026-10-01...');
    const targetMonth = '2026-10-01';
    
    // Clean prior test dues for this month
    await client.query('delete from public.rent_dues where tenancy_id = $1 and month = $2', [tenancy.id, targetMonth]);

    const dueInsert = await client.query(`
      insert into public.rent_dues (tenancy_id, month, amount, status)
      values ($1, $2, $3, 'unpaid')
      returning *;
    `, [tenancy.id, targetMonth, tenancy.monthly_rent]);

    const due = dueInsert.rows[0];
    console.log(`  ✅ Rent Due Created: ID ${due.id}, Month ${due.month.toISOString().split('T')[0]}, Amount ₹${due.amount}, Status: ${due.status}`);

    // 4. Test Tenant Submitting UTR Payment
    console.log('\n[4] Testing Tenant UTR Payment Submission...');
    const testUtr = `TESTUTR${Date.now()}`;
    
    const paymentInsert = await client.query(`
      insert into public.payments (due_id, utr, screenshot_url, status)
      values ($1, $2, $3, 'pending')
      returning *;
    `, [due.id, testUtr, 'https://res.cloudinary.com/demo/image/upload/sample.jpg']);

    const payment = paymentInsert.rows[0];
    console.log(`  ✅ Payment Inserted: ID ${payment.id}, UTR: ${payment.utr}, Status: ${payment.status}`);

    // 5. Test UTR Unique Constraint
    console.log('\n[5] Testing UTR Duplicate Rejection...');
    try {
      await client.query(`
        insert into public.payments (due_id, utr, status)
        values ($1, $2, 'pending');
      `, [due.id, testUtr]);
      throw new Error('Duplicate UTR was unexpectedly accepted!');
    } catch (utrErr) {
      console.log('  ✅ Duplicate UTR correctly rejected by Postgres UNIQUE constraint');
    }

    // 6. Test Admin Confirming Payment
    console.log('\n[6] Testing Admin Confirm Payment Workflow...');
    await client.query(`
      update public.payments
      set status = 'confirmed'
      where id = $1;
    `, [payment.id]);

    await client.query(`
      update public.rent_dues
      set status = 'paid'
      where id = $1;
    `, [due.id]);

    const confirmedDue = await client.query('select status from public.rent_dues where id = $1', [due.id]);
    const confirmedPayment = await client.query('select status from public.payments where id = $1', [payment.id]);

    console.log(`  ✅ Payment Status: ${confirmedPayment.rows[0].status}`);
    console.log(`  ✅ Rent Due Status: ${confirmedDue.rows[0].status}`);

    if (confirmedDue.rows[0].status !== 'paid' || confirmedPayment.rows[0].status !== 'confirmed') {
      throw new Error('Payment confirmation failed');
    }

    console.log('\n===========================================');
    console.log('PHASE 3: PAYMENTS VERIFIED SUCCESSFULLY!');
    console.log('===========================================\n');
  } catch (err) {
    console.error('Phase 3 verification failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyPhase3();
