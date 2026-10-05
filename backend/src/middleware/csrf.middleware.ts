import type {
  NextFunction,
  Request,
  Response
} from "express";

import {
  env,
  isProduction
} from "../config/env.js";

import {
  AppError
} from "./error.middleware.js";

const STATE_CHANGING_METHODS =
  new Set([
    "POST",
    "PUT",
    "PATCH",
    "DELETE"
  ]);

export function csrfProtection(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (
    !STATE_CHANGING_METHODS.has(
      req.method
    )
  ) {
    next();
    return;
  }

  const origin =
    req.header("Origin");

  if (!origin) {
    if (!isProduction) {
      next();
      return;
    }

    throw new AppError(
      403,
      "Request origin could not be verified.",
      "CSRF_ORIGIN_MISSING"
    );
  }

  if (
    origin !== env.APP_URL
  ) {
    throw new AppError(
      403,
      "Request origin could not be verified.",
      "CSRF_ORIGIN_REJECTED"
    );
  }

  next();
}