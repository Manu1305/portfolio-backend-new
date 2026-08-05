import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';
import { connectDB } from './config/db.js';
import { seedAdminUser } from './modules/auth/seedAdmin.js';

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => seedAdminUser())
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Backend listening on port ${PORT}`);
    });

    // without this, nodemon/PaaS restarts can kill the process while the
    // port and the MongoDB connection are still open, causing the next
    // start to race the OS releasing the socket (EADDRINUSE on Windows)
    const shutdown = (signal) => {
      console.log(`${signal} received, shutting down gracefully...`);
      server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
      });
      // don't hang forever if something's stuck
      setTimeout(() => process.exit(1), 5000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch((err) => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });
