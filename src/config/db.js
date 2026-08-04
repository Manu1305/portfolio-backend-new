import dns from 'dns';
import mongoose from 'mongoose';

// mongodb+srv:// needs DNS SRV record lookups, which some routers/ISPs
// silently drop even though normal DNS works fine. Point Node's own
// resolver at public DNS servers so this doesn't depend on the network's
// default DNS. Only affects this process, not the OS-wide DNS config.
const DNS_SERVERS = (process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
dns.setServers(DNS_SERVERS);

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');
}
