import os from 'node:os';
import { config } from './config.js';
import { migrate } from './db.js';
import { seedIfEmpty, DEMO_ACCOUNTS } from './seed.js';
import { createApp } from './app.js';

migrate();
seedIfEmpty();

const app = createApp();
app.listen(config.port, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  console.log(`\nMAANAS is running:`);
  console.log(`  On this computer:  http://localhost:${config.port}`);
  if (lan) console.log(`  On your phone/LAN: http://${lan}:${config.port}  (same Wi-Fi)`);
  console.log(`\nDemo logins:`);
  console.log(`  User       ${DEMO_ACCOUNTS.user.email} / ${DEMO_ACCOUNTS.user.password}`);
  console.log(`  Therapist  ${DEMO_ACCOUNTS.therapist.email} / ${DEMO_ACCOUNTS.therapist.password}`);
  console.log(`  Admin      ${DEMO_ACCOUNTS.admin.email} / ${DEMO_ACCOUNTS.admin.password}\n`);
});
