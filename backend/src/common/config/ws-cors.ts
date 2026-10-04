import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

// Resolved per handshake (not at decorator evaluation time) so CORS_ORIGIN loaded from .env applies.
export const wsCorsOptions: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim());
    callback(null, !origin || allowedOrigins.includes(origin));
  },
  credentials: true,
};
