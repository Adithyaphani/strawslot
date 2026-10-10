// Request validation. Every write endpoint parses its body with one of these.
import { z } from 'zod';
import { SCHED } from './lib/constants.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-12');
export const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number');
const machineType = z.enum(['super_seeder', 'happy_seeder', 'mulcher', 'baler']);

export const RegisterSchema = z.object({
  farmerName: z.string().trim().min(2, 'Enter your name').max(60),
  phone,
  language: z.enum(['en', 'hi', 'pa']).default('pa'),
  villageId: z.string().min(1, 'Choose your village'),
  acres: z.coerce.number().min(0.25, 'Minimum 0.25 acre').max(100, 'Maximum 100 acres'),
  harvestDate: isoDate,
  windowDays: z.coerce.number().int().min(7).max(30).default(SCHED.defaultWindowDays),
  preference: z.enum(['in_situ', 'ex_situ', 'any']).default('any'),
  tractor: z.object({ owns: z.boolean(), hp: z.coerce.number().min(0).max(150).default(0) }),
  location: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).optional(),
});

export const IssueSchema = z.object({
  fieldId: z.string().min(1),
  phone,
  type: z.enum(['machine_late', 'machine_not_needed', 'harvest_changed', 'other']),
  note: z.string().trim().max(300).optional().default(''),
});

export const LoginSchema = z.object({ user: z.string().default(''), password: z.string().default('') });
export const ReassignSchema = z.object({ fieldId: z.string(), machineId: z.string(), fromDate: isoDate });
export const FieldStatusSchema = z.object({ status: z.enum(['cleared', 'pending', 'burned']) });
export const MachineStatusSchema = z.object({ status: z.enum(['active', 'maintenance']) });
export const AutofixSchema = z.object({ fieldId: z.string() });
export const ResolveSchema = z.object({ note: z.string().trim().max(300).optional().default('') });
export const WhatIfSchema = z.object({
  add: z.array(z.object({ chcId: z.string(), type: machineType, count: z.coerce.number().int().min(1).max(20) })).max(20).default([]),
  fixMaintenance: z.boolean().default(false),
  extraTractors: z.coerce.number().int().min(0).max(30).default(0),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
