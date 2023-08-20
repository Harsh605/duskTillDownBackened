import { Router } from "express";
import { getPvReportData, importPvReport } from "../controllers/PvReportController.js"
import { getGenealogyReportData, importGenealogyReport } from "../controllers/GenealogyReportController.js";
import { getRankAdvancementReportData, importRankAdvancementReport } from "../controllers/RankAdvancementReport.js";
import { getForcastingEstimate, importPointsAndRankupReport, orderReportFullYear } from "../controllers/PointsAndRankupController.js";
import { userLogin } from "../controllers/user-controllers.js";
import { isAuthenticatedUser } from "../middleware/auth.js";

const reportRoutes = Router()

reportRoutes.post("/upload/pvReport",isAuthenticatedUser,importPvReport)
reportRoutes.post("/get/pvReportData",isAuthenticatedUser,getPvReportData)

reportRoutes.post("/upload/genealogyReport",isAuthenticatedUser,importGenealogyReport)
reportRoutes.post("/get/genealogyReportData",isAuthenticatedUser,getGenealogyReportData)

reportRoutes.post("/upload/rankAdvancementReport",isAuthenticatedUser,importRankAdvancementReport)
reportRoutes.post("/get/rankAdvancementReportData",isAuthenticatedUser,getRankAdvancementReportData)


reportRoutes.post("/upload/pointsAndRankupReport",isAuthenticatedUser,importPointsAndRankupReport)
reportRoutes.post("/get/pointsAndRankupReportData",isAuthenticatedUser,getForcastingEstimate)
reportRoutes.post("/get/orderReportFullYear",isAuthenticatedUser,orderReportFullYear)

reportRoutes.get("/login",userLogin)


export default reportRoutes