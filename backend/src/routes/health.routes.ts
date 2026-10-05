import { Router } from "express";

import { healthCheck } from "../controllers/health.controller.js";

const router = Router();

/**
 * Liveness/readiness health endpoint.
 *
 * The controller is responsible for determining the current health state.
 * This route intentionally contains no authentication requirement so that
 * Railway and other infrastructure can verify that the API is reachable.
 */
router.get(
  "/",
  healthCheck,
);

export default router;