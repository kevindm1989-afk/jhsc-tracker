import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

export function validate(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;
    next();
  };
}

export const actionItemSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  assignedTo: z.string().max(200).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["open", "in-progress", "completed", "verified"]).optional(),
  location: z.string().max(200).optional().nullable(),
  department: z.string().max(200).optional().nullable(),
  ohsaReference: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const hazardFindingSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional().nullable(),
  department: z.string().max(200).optional().nullable(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["open", "in-progress", "completed", "verified"]).optional(),
  assignedTo: z.string().max(200).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  ohsaReference: z.string().max(200).optional().nullable(),
  correctiveAction: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const workerStatementSchema = z.object({
  employeeName: z.string().min(1).max(200),
  department: z.string().max(200).optional().nullable(),
  shift: z.string().max(100).optional().nullable(),
  dateOfIncident: z.string().optional().nullable(),
  incidentType: z.string().max(200).optional().nullable(),
  description: z.string().min(1).max(5000),
  witnesses: z.string().max(1000).optional().nullable(),
  injuryOccurred: z.boolean().optional(),
  medicalAttention: z.boolean().optional(),
  reportedToManagement: z.boolean().optional(),
  ohsaReference: z.string().max(200).optional().nullable(),
  status: z.enum(["open", "under-review", "closed"]).optional(),
});

export const suggestionSchema = z.object({
  employeeName: z.string().min(1).max(200),
  department: z.string().max(200).optional().nullable(),
  shift: z.string().max(100).optional().nullable(),
  dateSubmitted: z.string().optional().nullable(),
  dateObserved: z.string().optional().nullable(),
  priorityLevel: z.enum(["low", "medium", "high", "critical"]).optional().nullable(),
  locationOfConcern: z.string().max(200).optional().nullable(),
  description: z.string().min(1).max(5000),
  proposedSolution: z.string().max(5000).optional().nullable(),
});
