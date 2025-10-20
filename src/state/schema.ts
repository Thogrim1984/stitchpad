import { z } from 'zod';

export const zVec2 = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const zGrid = z.object({
  origin: zVec2,
  u: zVec2,
  v: zVec2,
  rows: z.number().int().min(1),
  cols: z.number().int().min(1),
});

export const zPage = z.object({
  fingerprint: z.string().min(1),
  page: z.number().int().min(1),
  grid: zGrid.optional(),
  ticks: z
    .array(z.string().regex(/^\d+:\d+$/))
    .transform((value) => Array.from(new Set(value))), // dedupe on import
});

export const zProjectFile = z.object({
  version: z.literal(1),
  project: z
    .object({
      id: z.string().optional(),
      title: z.string().optional(),
    })
    .partial()
    .default({}),
  pages: z.array(zPage),
});

export type GridSchema = z.infer<typeof zGrid>;
export type ProjectFile = z.infer<typeof zProjectFile>;
