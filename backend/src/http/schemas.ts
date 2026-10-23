// Every request body and query string is parsed with one of these. They also generate the OpenAPI document.
import { z } from 'zod';
import { SCHED } from '../domain/constants.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-12');
export const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number');
const machineType = z.enum(['super_seeder', 'happy_seeder', 'mulcher', 'baler']);
const lang = z.enum(['en', 'hi', 'pa']);

export const RegisterSchema = z.object({
  farmerName: z.string().trim().min(2, 'Enter your name').max(60),
  phone,
  language: lang.default('pa'),
  villageId: z.string().min(1, 'Choose your village').max(60),
  acres: z.coerce.number().min(0.25, 'Minimum 0.25 acre').max(100, 'Maximum 100 acres'),
  harvestDate: isoDate,
  windowDays: z.coerce.number().int().min(7).max(30).default(SCHED.defaultWindowDays),
  preference: z.enum(['in_situ', 'ex_situ', 'any']).default('any'),
  tractor: z.object({ owns: z.boolean(), hp: z.coerce.number().min(0).max(150).default(0) }),
  location: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).optional(),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const IssueSchema = z.object({
  fieldId: z.string().min(1).max(30), phone,
  type: z.enum(['machine_late', 'machine_not_needed', 'harvest_changed', 'other']),
  note: z.string().trim().max(300).optional().default(''),
});
export const LookupQuery = z.object({ phone: z.string().trim().default(''), lang: lang.optional() });

// the web app sends { user, password }; { username, password } is accepted too
export const LoginSchema = z.object({
  user: z.string().trim().max(80).optional(), username: z.string().trim().max(80).optional(),
  password: z.string().trim().max(200).default(''),
}).transform((b) => ({ username: b.user ?? b.username ?? '', password: b.password }));
export const RefreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });

export const ReassignSchema = z.object({ fieldId: z.string(), machineId: z.string(), fromDate: isoDate });
export const FieldStatusSchema = z.object({ status: z.enum(['cleared', 'pending', 'burned']), expectedVersion: z.number().int().optional() });
export const MachineStatusSchema = z.object({ status: z.enum(['active', 'maintenance']) });
export const AutofixSchema = z.object({ fieldId: z.string() });
export const ResolveSchema = z.object({ note: z.string().trim().max(300).optional().default('') });
export const WhatIfSchema = z.object({
  add: z.array(z.object({ chcId: z.string(), type: machineType, count: z.coerce.number().int().min(1).max(20) })).max(20).default([]),
  fixMaintenance: z.boolean().default(false),
  extraTractors: z.coerce.number().int().min(0).max(30).default(0),
});

export const FieldsQuery = z.object({
  q: z.string().trim().max(80).optional(), status: z.string().max(20).optional(), block: z.string().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(), offset: z.coerce.number().int().min(0).optional(),
});
export const AuditQuery = z.object({ limit: z.coerce.number().int().min(1).max(500).default(150), before: z.coerce.number().int().optional() });
export const DistrictQuery = z.object({ district: z.string().trim().max(40).optional() });

export const CreateUserSchema = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/, 'Letters, numbers, dot, dash and underscore only'),
  displayName: z.string().trim().min(2).max(80),
  password: z.string().min(10, 'Use at least 10 characters').max(200),
  role: z.enum(['viewer', 'officer', 'admin']).default('officer'),
});
export const UpdateUserSchema = z.object({
  active: z.boolean().optional(), role: z.enum(['viewer', 'officer', 'admin']).optional(),
  password: z.string().min(10).max(200).optional(), displayName: z.string().trim().min(2).max(80).optional(),
});
