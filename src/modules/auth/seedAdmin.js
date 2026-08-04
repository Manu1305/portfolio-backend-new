import User from './user.model.js';

// Runs once at startup. If the users collection is already populated, the DB
// is the source of truth and this is a no-op — env vars only bootstrap the
// very first admin account.
export async function seedAdminUser() {
  const existing = await User.countDocuments();
  if (existing > 0) return;

  const { ADMIN_USERNAME, ADMIN_PASSWORD_HASH } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {
    console.warn('No users in the database yet, and ADMIN_USERNAME/ADMIN_PASSWORD_HASH are not set — skipping admin seed. Login will fail until a user exists.');
    return;
  }

  await User.create({ username: ADMIN_USERNAME, passwordHash: ADMIN_PASSWORD_HASH, role: 'admin' });
  console.log(`Seeded initial admin user "${ADMIN_USERNAME}"`);
}
