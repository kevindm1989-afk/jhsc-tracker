import { Router, type IRouter } from "express";
import healthRouter from "./health";
import actionItemsRouter from "./actionItems";
import hazardFindingsRouter from "./hazardFindings";
import inspectionLogRouter from "./inspectionLog";
import workerStatementsRouter from "./workerStatements";
import dashboardRouter from "./dashboard";
import importRouter from "./import";
import inspectRouter from "./inspect";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/action-items", actionItemsRouter);
router.use("/hazard-findings", hazardFindingsRouter);
router.use("/inspection-log", inspectionLogRouter);
router.use("/worker-statements", workerStatementsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/import", importRouter);
router.use("/inspect", inspectRouter);

export default router;
