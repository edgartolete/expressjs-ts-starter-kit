import { rateLimit } from 'express-rate-limit';
import { mode } from '../config';

export const requestRateLimiter = rateLimit({
	windowMs: 60000, //1 minute
	limit: mode['dev'] ? 10000 : 15, // Limit each IP to 15 requests per `window` (here, per 1 minute).
	standardHeaders: 'draft-7', // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false // Disable the `X-RateLimit-*` headers
});
