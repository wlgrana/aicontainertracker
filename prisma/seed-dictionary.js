#!/usr/bin/env node
/**
 * Seed Dictionary from YAML Files
 * 
 * This script loads the container_ontology.yml file and creates
 * baseline HeaderMapping records for all header synonyms.
 */

const { PrismaClient } = require('@prisma/client');
const yaml = require('yaml');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function seedDictionary() {
    console.log('\n' + '='.repeat(80));
    console.log('🌱 SEEDING DICTIONARY FROM YAML FILES');
    console.log('='.repeat(80));

    // Load container ontology YAML
    const ontologyPath = path.join(process.cwd(), 'agents', 'dictionaries', 'container_ontology.yml');
    const ontologyContent = fs.readFileSync(ontologyPath, 'utf-8');
    const ontology = yaml.parse(ontologyContent);

    const mappingsToCreate = [];

    // Process required fields
    console.log('\n📋 Processing required_fields...');
    for (const [fieldName, fieldDef] of Object.entries(ontology.required_fields || {})) {
        if (fieldDef.header_synonyms && Array.isArray(fieldDef.header_synonyms)) {
            for (const synonym of fieldDef.header_synonyms) {
                // Skip nested objects (like mbl_or_booking)
                if (typeof synonym === 'string') {
                    mappingsToCreate.push({
                        excelHeader: synonym,
                        canonicalField: fieldName,
                        confidence: 1.0, // YAML seeds are verified
                        timesUsed: 0,
                        source: 'YAML_SEED'
                    });
                }
            }
        }

        // Handle nested synonyms (like mbl_or_booking)
        if (fieldDef.header_synonyms && typeof fieldDef.header_synonyms === 'object' && !Array.isArray(fieldDef.header_synonyms)) {
            for (const [subField, synonyms] of Object.entries(fieldDef.header_synonyms)) {
                if (Array.isArray(synonyms)) {
                    for (const synonym of synonyms) {
                        mappingsToCreate.push({
                            excelHeader: synonym,
                            canonicalField: fieldName,
                            confidence: 1.0,
                            timesUsed: 0,
                            source: 'YAML_SEED'
                        });
                    }
                }
            }
        }
    }

    // Process optional fields
    console.log('📋 Processing optional_fields...');
    for (const [fieldName, fieldDef] of Object.entries(ontology.optional_fields || {})) {
        if (fieldDef.header_synonyms && Array.isArray(fieldDef.header_synonyms)) {
            for (const synonym of fieldDef.header_synonyms) {
                if (typeof synonym === 'string') {
                    mappingsToCreate.push({
                        excelHeader: synonym,
                        canonicalField: fieldName,
                        confidence: 1.0,
                        timesUsed: 0,
                        source: 'YAML_SEED'
                    });
                }
            }
        }
    }

    console.log(`\n✅ Found ${mappingsToCreate.length} header synonyms in YAML`);

    // Clear existing YAML seeds (in case we're re-seeding)
    console.log('\n🗑️  Clearing existing YAML seed mappings...');
    // Note: We can't filter by source since it's not in the schema yet
    // For now, we'll just clear all mappings
    const deleted = await prisma.headerMapping.deleteMany();
    console.log(`   Deleted ${deleted.count} existing mappings`);

    // Create new mappings
    console.log('\n💾 Creating HeaderMapping records...');
    let created = 0;
    let skipped = 0;

    for (const mapping of mappingsToCreate) {
        try {
            await prisma.headerMapping.create({
                data: {
                    excelHeader: mapping.excelHeader,
                    canonicalField: mapping.canonicalField,
                    confidence: mapping.confidence,
                    timesUsed: mapping.timesUsed
                }
            });
            created++;

            if (created % 50 === 0) {
                console.log(`   Created ${created}/${mappingsToCreate.length}...`);
            }
        } catch (error) {
            // Skip duplicates (unique constraint violation)
            if (error.code === 'P2002') {
                skipped++;
            } else {
                console.error(`   Error creating mapping "${mapping.excelHeader}" -> "${mapping.canonicalField}":`, error.message);
            }
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ SEEDING COMPLETE');
    console.log('='.repeat(80));
    console.log(`   Created: ${created} mappings`);
    console.log(`   Skipped: ${skipped} duplicates`);
    console.log(`   Total in database: ${await prisma.headerMapping.count()}`);
    console.log('='.repeat(80));

    // Show sample mappings
    console.log('\n📊 Sample Mappings:');
    const samples = await prisma.headerMapping.findMany({
        take: 10,
        orderBy: { excelHeader: 'asc' }
    });

    samples.forEach(m => {
        console.log(`   "${m.excelHeader}" -> ${m.canonicalField} (${(m.confidence * 100).toFixed(0)}%)`);
    });

    await prisma.$disconnect();
}

seedDictionary().catch(error => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
});
