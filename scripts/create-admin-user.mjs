// scripts/create-admin-user.mjs
// One-time script to create the first admin account.
// Run via: npm run admin:create
// Requires .env.local with: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_FULL_NAME ?? '';

// Validate required env vars
const missing = [];
if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!email) missing.push('ADMIN_EMAIL');
if (!password) missing.push('ADMIN_PASSWORD');

if (missing.length > 0) {
  console.error('\nMissing required environment variables:');
  missing.forEach((v) => console.error(`  - ${v}`));
  console.error('\nAdd them to .env.local and run:');
  console.error('  npm run admin:create\n');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`\nCreating admin user: ${email}`);

const { data: authData, error: authError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: fullName ? { full_name: fullName } : {},
});

let userId;

if (authError) {
  const msg = authError.message ?? '';
  if (msg.includes('already been registered') || msg.includes('already exists')) {
    console.log('Auth user already exists. Looking up existing user...');
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('Error listing users:', listError.message);
      process.exit(1);
    }
    const existing = listData.users.find((u) => u.email === email);
    if (!existing) {
      console.error('Could not find existing user with that email.');
      process.exit(1);
    }
    userId = existing.id;
    console.log('Found existing auth user:', userId);
  } else {
    console.error('Error creating auth user:', authError.message);
    process.exit(1);
  }
} else {
  userId = authData.user.id;
  console.log('Auth user created:', userId);
}

// Upsert into admin_users
const { error: upsertError } = await supabase
  .from('admin_users')
  .upsert({ user_id: userId, email, role: 'admin' }, { onConflict: 'user_id' });

if (upsertError) {
  console.error('\nError upserting admin_users:', upsertError.message);
  if (upsertError.message?.includes('does not exist') || upsertError.code === '42P01') {
    console.error('\nThe admin_users table does not exist.');
    console.error('Run the SQL migration in supabase/schema.sql first (admin_users section).\n');
  }
  process.exit(1);
}

console.log('\nAdmin user ready:');
console.log('  Email  :', email);
console.log('  User ID:', userId);
console.log('\nLog in at /admin/login\n');
