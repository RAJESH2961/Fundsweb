import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './prisma/client';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`ERP API listening on http://localhost:${env.port}`);
  console.log(`Swagger UI at http://localhost:${env.port}/api-docs`);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
