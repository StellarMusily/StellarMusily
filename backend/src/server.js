import 'dotenv/config';
import { app } from './app.js';
import { stellarEnabled } from './stellar.js';

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Tempo API on http://localhost:${port}`);
  if (!stellarEnabled) console.log('Stellar disabled (dry-run). Fill in .env to enable on-chain calls.');
});
