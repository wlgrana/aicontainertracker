import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

export async function GET() {
    console.log('[DEBUG] Diagnostic endpoint called');

    const diagnostics: any = {
        timestamp: new Date().toISOString(),
        environment: {
            VERCEL: process.env.VERCEL,
            VERCEL_ENV: process.env.VERCEL_ENV,
            NODE_ENV: process.env.NODE_ENV,
            nodeVersion: process.version,
            isVercel: process.env.VERCEL === '1',
            cwd: process.cwd()
        },
        filesystem: {},
        database: {},
        scripts: {},
        errors: []
    };

    // Check testdata directory
    try {
        console.log('[DEBUG] Checking testdata directory...');
        const testdataPath = path.join(process.cwd(), 'testdata');
        diagnostics.filesystem.testdataPath = testdataPath;
        diagnostics.filesystem.testdataExists = fs.existsSync(testdataPath);

        if (fs.existsSync(testdataPath)) {
            diagnostics.filesystem.testdataFiles = fs.readdirSync(testdataPath);
            console.log('[DEBUG] Found', diagnostics.filesystem.testdataFiles.length, 'files in testdata');
        } else {
            console.log('[DEBUG] testdata directory does not exist');
        }
    } catch (e: any) {
        console.error('[DEBUG] Filesystem check failed:', e);
        diagnostics.errors.push(`Filesystem check failed: ${e.message}`);
    }

    // Check uploads directory
    try {
        console.log('[DEBUG] Checking uploads directory...');
        const uploadsPath = path.join(process.cwd(), 'uploads');
        diagnostics.filesystem.uploadsPath = uploadsPath;
        diagnostics.filesystem.uploadsExists = fs.existsSync(uploadsPath);

        if (fs.existsSync(uploadsPath)) {
            diagnostics.filesystem.uploadsFiles = fs.readdirSync(uploadsPath);
            console.log('[DEBUG] Found', diagnostics.filesystem.uploadsFiles.length, 'files in uploads');
        } else {
            console.log('[DEBUG] uploads directory does not exist');
        }
    } catch (e: any) {
        console.error('[DEBUG] Uploads check failed:', e);
        diagnostics.errors.push(`Uploads check failed: ${e.message}`);
    }

    // Check database connection
    try {
        console.log('[DEBUG] Testing database connection...');
        await prisma.$connect();
        diagnostics.database.connected = true;
        console.log('[DEBUG] Database connected');

        const containerCount = await prisma.container.count();
        diagnostics.database.containerCount = containerCount;
        console.log('[DEBUG] Container count:', containerCount);

        const importLogCount = await prisma.importLog.count();
        diagnostics.database.importLogCount = importLogCount;
        console.log('[DEBUG] ImportLog count:', importLogCount);

        const rawRowCount = await prisma.rawRow.count();
        diagnostics.database.rawRowCount = rawRowCount;
        console.log('[DEBUG] RawRow count:', rawRowCount);
    } catch (e: any) {
        console.error('[DEBUG] Database check failed:', e);
        diagnostics.database.connected = false;
        diagnostics.database.error = e.message;
        diagnostics.database.stack = e.stack;
    }

    // Check if scripts exist
    try {
        console.log('[DEBUG] Checking script files...');
        const scriptsPath = path.join(process.cwd(), 'scripts');
        diagnostics.scripts.scriptsPath = scriptsPath;
        diagnostics.scripts.scriptsExists = fs.existsSync(scriptsPath);

        if (fs.existsSync(scriptsPath)) {
            diagnostics.scripts.archivist = fs.existsSync(path.join(scriptsPath, 'step1_archivist.ts'));
            diagnostics.scripts.translator = fs.existsSync(path.join(scriptsPath, 'step2_translator.ts'));
            diagnostics.scripts.auditor = fs.existsSync(path.join(scriptsPath, 'step3_auditor.ts'));
            diagnostics.scripts.importer = fs.existsSync(path.join(scriptsPath, 'step4_importer.ts'));
            diagnostics.scripts.learner = fs.existsSync(path.join(scriptsPath, 'step5_learner.ts'));
            console.log('[DEBUG] Script check complete');
        }
    } catch (e: any) {
        console.error('[DEBUG] Script check failed:', e);
        diagnostics.errors.push(`Script check failed: ${e.message}`);
    }

    // Check agents directory
    try {
        console.log('[DEBUG] Checking agents directory...');
        const agentsPath = path.join(process.cwd(), 'agents');
        diagnostics.scripts.agentsPath = agentsPath;
        diagnostics.scripts.agentsExists = fs.existsSync(agentsPath);

        if (fs.existsSync(agentsPath)) {
            diagnostics.scripts.agentFiles = fs.readdirSync(agentsPath);
            console.log('[DEBUG] Found', diagnostics.scripts.agentFiles.length, 'agent files');
        }
    } catch (e: any) {
        console.error('[DEBUG] Agents check failed:', e);
        diagnostics.errors.push(`Agents check failed: ${e.message}`);
    }

    // Check DATABASE_URL
    diagnostics.database.databaseUrlExists = !!process.env.DATABASE_URL;
    diagnostics.database.databaseUrlLength = process.env.DATABASE_URL?.length || 0;

    console.log('[DEBUG] Diagnostic check complete');
    return NextResponse.json(diagnostics, { status: 200 });
}
