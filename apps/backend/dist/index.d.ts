import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
declare const prisma: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
declare let redis: ReturnType<typeof createClient> | null;
export default function handler(req: any, res: any): Promise<any>;
export { prisma, redis };
//# sourceMappingURL=index.d.ts.map