import type { Request, Response, NextFunction } from 'express';
import type { Config } from '../../shared/config.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('audit');

export function createAuditLogger(config: Config) {
  if (!config.AUDIT_LOG_ENABLED) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        authenticated: !!req.header('X-API-Key'),
      });
    });

    next();
  };
}
