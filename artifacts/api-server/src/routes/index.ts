import { Router, type IRouter } from "express";
import healthRouter from "./health";
import actionItemsRouter from "./actionItems";
import hazardFindingsRouter from "./hazardFindings";
import inspectionLogRouter from "./inspectionLog";
import workerStatementsRouter from "./workerStatements";
import closedItemsLogRouter from "./closedItemsLog";
import memberActionsRouter from "./memberActions";
import healthSafetyReportsRouter from "./healthSafetyReports";
import suggestionsRouter from "./suggestions";
import dashboardRouter from "./dashboard";
import importRouter from "./import";
import inspectRouter from "./inspect";
import authRouter from "./auth";
import usersRouter from "./users";
import registrationsRouter from "./registrations";
import settingsRouter from "./settings";
import rightToRefuseRouter from "./rightToRefuse";
import attachmentsRouter from "./attachments";
import folderFilesRouter from "./folderFiles";
import transcriptionRouter from "./transcription";
import inspectionChecklistsRouter from "./inspectionChecklists";
import inspectionScheduleRouter from "./inspectionSchedule";
import { requireAuth, requirePermission } from "../middleware/requireAuth";

const router: IRouter = Router();

// Public routes (no auth required)
router.use(healthRouter);
router.use("/auth", authRouter);

// Protected routes — require login
router.use("/dashboard", requireAuth, requirePermission("dashboard"), dashboardRouter);
router.use("/action-items", requireAuth, requirePermission("action-items"), actionItemsRouter);
router.use("/hazard-findings", requireAuth, requirePermission("hazard-findings"), hazardFindingsRouter);
router.use("/inspection-log", requireAuth, requirePermission("inspection-log"), inspectionLogRouter);
router.use("/worker-statements", requireAuth, requirePermission("worker-statements"), workerStatementsRouter);
router.use("/closed-items-log", requireAuth, requirePermission("closed-items-log"), closedItemsLogRouter);
router.use("/member-actions", requireAuth, memberActionsRouter);
router.use("/health-safety-reports", requireAuth, healthSafetyReportsRouter);
router.use("/suggestions", requireAuth, suggestionsRouter);
router.use("/import", requireAuth, requirePermission("import-data"), importRouter);
router.use("/inspect", requireAuth, requirePermission("conduct-inspection"), inspectRouter);
router.use("/settings", requireAuth, settingsRouter);
router.use("/right-to-refuse", requireAuth, rightToRefuseRouter);
router.use("/attachments", requireAuth, attachmentsRouter);
router.use("/folder-files", requireAuth, folderFilesRouter);
router.use("/checklists", requireAuth, inspectionChecklistsRouter);
router.use("/inspection-schedule", requireAuth, inspectionScheduleRouter);

// Admin-only routes
router.use("/transcription", requireAuth, transcriptionRouter);
router.use("/users", usersRouter);
router.use("/registrations", registrationsRouter);

export default router;
