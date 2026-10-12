const { Client } = require('pg');
require('dotenv').config();

async function seedAdmin() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    const adminEmail = 'admin@house.app';
    const adminPassword = 'adminPassword123!';
    const adminName = 'Admin House Manager';
    const adminPhone = '9999999999';

    // Check if admin already exists
    const existing = await client.query('select id from auth.users where email = $1', [adminEmail]);
    let adminId;

    if (existing.rows.length > 0) {
      adminId = existing.rows[0].id;
      console.log('Admin user already exists with ID:', adminId);
    } else {
      console.log('Creating initial admin user in auth.users...');
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
          '{"must_change_password":false}',
          now(),
          now()
        ) returning id;
      `, [adminEmail, adminPassword]);

      adminId = insertUser.rows[0].id;
      console.log('Admin user created in auth.users with ID:', adminId);
    }

    // Insert or update profile
    await client.query(`
      insert into public.profiles (id, name, phone, role, is_active)
      values ($1, $2, $3, 'admin', true)
      on conflict (id) do update set
        role = 'admin',
        name = excluded.name,
        phone = excluded.phone,
        is_active = true;
    `, [adminId, adminName, adminPhone]);

    console.log('Admin profile successfully configured!');
    console.log('--------------------------------------------------');
    console.log('Admin Credentials:');
    console.log(`Email / Login: ${adminEmail} (or phone: ${adminPhone})`);
    console.log(`Password:      ${adminPassword}`);
    console.log('--------------------------------------------------');
  } catch (err) {
    console.error('Failed to seed admin:', err);
  } finally {
    await client.end();
  }
}

seedAdmin();
