const { Client } = require('pg');
require('dotenv').config();

async function seedTestTenant() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    const tenantPhone = '9876543210';
    const tenantEmail = `${tenantPhone}@house.app`;
    const tempPassword = 'tempPassword123!';
    const tenantName = 'Rohan Sharma';

    const existing = await client.query('select id from auth.users where email = $1', [tenantEmail]);
    let tenantId;

    if (existing.rows.length > 0) {
      tenantId = existing.rows[0].id;
      console.log('Test tenant already exists with ID:', tenantId);
      await client.query(`
        update auth.users
        set encrypted_password = crypt($2, gen_salt('bf', 10)),
            raw_user_meta_data = '{"must_change_password":true}',
            email_confirmed_at = coalesce(email_confirmed_at, now()),
            updated_at = now()
        where id = $1;
      `, [tenantId, tempPassword]);
      console.log('Test tenant password and metadata reset in auth.users.');
    } else {
      console.log('Creating test tenant in auth.users with must_change_password: true...');
      const insertUser = await client.query(`
        insert into auth.users (
          instance_id,
          id,
          aud,
          role,
          email,
          encrypted_password,
          email_confirmed_at,
          raw_app_meta_data,
          raw_user_meta_data,
          created_at,
          updated_at
        ) values (
          '00000000-0000-0000-0000-000000000000',
          gen_random_uuid(),
          'authenticated',
          'authenticated',
          $1,
          crypt($2, gen_salt('bf')),
          now(),
          '{"provider":"email","providers":["email"]}',
          '{"must_change_password":true}',
          now(),
          now()
        ) returning id;
      `, [tenantEmail, tempPassword]);

      tenantId = insertUser.rows[0].id;
    }

    // Insert or update profile
    await client.query(`
      insert into public.profiles (id, name, phone, role, is_active)
      values ($1, $2, $3, 'tenant', true)
      on conflict (id) do update set
        role = 'tenant',
        name = excluded.name,
        phone = excluded.phone,
        is_active = true;
    `, [tenantId, tenantName, tenantPhone]);

    console.log('Test tenant configured!');
    console.log('--------------------------------------------------');
    console.log('Tenant Credentials:');
    console.log(`Phone:         ${tenantPhone}`);
    console.log(`Email Alias:   ${tenantEmail}`);
    console.log(`Temp Password: ${tempPassword}`);
    console.log('must_change_password: true');
    console.log('--------------------------------------------------');
  } catch (err) {
    console.error('Failed to seed test tenant:', err);
  } finally {
    await client.end();
  }
}

seedTestTenant();
