const { Client } = require('pg');
require('dotenv').config();

async function fixIdentities() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const users = await client.query('SELECT id, email FROM auth.users;');
  console.log('Found users:', users.rows);

  for (const user of users.rows) {
    const identityId = user.id;
    const email = user.email;
    const identityData = JSON.stringify({ sub: user.id, email: user.email });

    await client.query(`
      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES ($1, $2, $3::jsonb, $4, $5, now(), now(), now())
      ON CONFLICT (provider, provider_id) DO NOTHING;
    `, [identityId, identityId, identityData, 'email', identityId]);

    console.log(`Synced identity for: ${email}`);
  }

  const identities = await client.query('SELECT id, user_id, provider, email FROM auth.identities;');
  console.log('All identities in DB:', identities.rows);

  await client.end();
}

fixIdentities()
  .then(() => console.log('Done!'))
  .catch(err => {
    console.error('Error fixing identities:', err);
    process.exit(1);
  });
