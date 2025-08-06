#!/usr/bin/env node

/**
 * Generate JSON Schema from Zod schema for visc configuration
 */

import { zodToJsonSchema } from 'zod-to-json-schema';
import { ViscConfigSchema } from '../src/schema/config.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate JSON Schema
const jsonSchema = zodToJsonSchema(ViscConfigSchema, {
  name: 'ViscConfig',
  $refStrategy: 'none', // Inline all references for better IDE support
  errorMessages: true,
  markdownDescription: true,
});

// Add additional metadata
const schemaWithMeta = {
  ...jsonSchema,
  $id: 'https://github.com/mizchi/visc/schema/visc.config.json',
  title: 'Visual Checker (visc) Configuration',
  description: 'Configuration schema for visc visual regression testing tool',
};

// Output path
const schemaPath = path.join(__dirname, '..', 'schema.json');

// Write schema file
fs.writeFileSync(schemaPath, JSON.stringify(schemaWithMeta, null, 2));
console.log(`✅ JSON Schema generated: ${schemaPath}`);