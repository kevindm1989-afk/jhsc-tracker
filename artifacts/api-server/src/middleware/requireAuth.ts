import { Request, Response, NextFunction } from "express";
import "../sessionTypes";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.session?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    // admin and co-chair have full module access
    if (req.session?.role === "admin" || req.session?.role === "co-chair") return next();
    if (!req.session?.permissions?.includes(permission)) {
      return res.status(403).json({ error: "You do not have permission to access this resource" });
    }
    next();
  };
}
