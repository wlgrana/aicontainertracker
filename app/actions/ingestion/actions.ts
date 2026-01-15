"use server";

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getImportLogs() {
    return await prisma.importLog.findMany({
        orderBy: { importedOn: 'desc' },
        take: 10
    });
}

export async function getImportLogDetails(fileName: string) {
    const log = await prisma.importLog.findUnique({
        where: { fileName },
        include: {
            rawRows: {
                take: 100 // Limit for performance
            },
            // containers: true // We don't have direct relation, we have to find by importLogId
        }
    });

    if (!log) return null;

    // Fetch related containers manually or via relation if added
    const containers = await prisma.container.findMany({
        where: { importLogId: fileName },
        orderBy: { containerNumber: 'asc' }
    });

    return { ...log, containers };
}

export async function deleteImportLog(fileName: string) {
    await prisma.rawRow.deleteMany({ where: { importLogId: fileName } });
    await prisma.importLog.delete({ where: { fileName } });
    revalidatePath('/ingestion');
}
