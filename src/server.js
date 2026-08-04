import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';
import { seedAdminUser } from './modules/auth/seedAdmin.js';

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => seedAdminUser())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });
