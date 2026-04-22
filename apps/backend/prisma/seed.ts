import { PrismaClient, ResellerType, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => BigInt(s));

  for (const tgId of adminIds) {
    await prisma.reseller.upsert({
      where: { telegramId: tgId },
      update: { role: Role.ADMIN, isActive: true },
      create: {
        telegramId: tgId,
        role: Role.ADMIN,
        type: ResellerType.PREMIUM,
        maxClients: 100000,
        isActive: true,
      },
    });
    console.log(`[seed] ensured admin for telegram id ${tgId}`);
  }

  const squadStd = process.env.SQUAD_STANDARD_UUID;
  const squadPrm = process.env.SQUAD_PREMIUM_UUID;

  if (squadStd) {
    await prisma.squadMapping.upsert({
      where: { type: ResellerType.STANDARD },
      update: { squadUuid: squadStd },
      create: { type: ResellerType.STANDARD, squadUuid: squadStd, label: 'Standard' },
    });
    console.log(`[seed] mapped STANDARD -> ${squadStd}`);
  }
  if (squadPrm) {
    await prisma.squadMapping.upsert({
      where: { type: ResellerType.PREMIUM },
      update: { squadUuid: squadPrm },
      create: { type: ResellerType.PREMIUM, squadUuid: squadPrm, label: 'Premium' },
    });
    console.log(`[seed] mapped PREMIUM -> ${squadPrm}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
