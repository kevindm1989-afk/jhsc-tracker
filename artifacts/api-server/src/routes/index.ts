import { Router, type IRouter } from "express";
import healthRouter from "./health";
import actionItemsRouter from "./actionItems";
import hazardFindingsRouter from "./hazardFindings";
import inspectionLogRouter from "./inspectionLog";
import workerStatementsRouter from "./workerStatements";
import closedItemsLogRouter from "./closedItemsLog";
import dashboardRouter from "./dashboard";
import importRouter from "./import";
import inspectRouter from "./inspect";
import authRouter from "./auth";
import usersRouter from "./users";
import storageRouter from "./storage";
import documentsRouter from "./documents";
import { requireAuth, requirePermission } from "../middleware/requireAuth";

const router: IRouter = Router();

// Public routes (no auth required)
router.use(healthRouter);
router.use("/auth", authRouter);

// Storage (presigned URL + object serving — auth required, handled inside router)
router.use(storageRouter);

// Protected routes — require login
router.use("/dashboard", requireAuth, requirePermission("dashboard"), dashboardRouter);
router.use("/action-items", requireAuth, requirePermission("action-items"), actionItemsRouter);
router.use("/hazard-findings", requireAuth, requirePermission("hazard-findings"), hazardFindingsRouter);
router.use("/inspection-log", requireAuth, requirePermission("inspection-log"), inspectionLogRouter);
router.use("/worker-statements", requireAuth, requirePermission("worker-statements"), workerStatementsRouter);
router.use("/closed-items-log", requireAuth, requirePermission("action-items"), closedItemsLogRouter);
router.use("/import", requireAuth, requirePermission("import-data"), importRouter);
router.use("/inspect", requireAuth, requirePermission("conduct-inspection"), inspectRouter);
router.use("/documents", requirePermission("documents"), documentsRouter);

// Admin-only routes
router.use("/users", usersRouter);

export default router;
