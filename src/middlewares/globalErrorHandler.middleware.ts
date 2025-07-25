import type { NextFunction, Request, Response } from "express";

import ErrorHandler from "../errors/errorHandler.error";

export function globalErrorHandler(
  error: any,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const errorHandler = new ErrorHandler(process.env.SLACK_ERROR_WEBHOOK || "");

  errorHandler.handleHttpError(
    res,
    error.message || "Internal server error",
    error.status || 500,
    error,
  );
}
