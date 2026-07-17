import { Router } from 'express';
import { searchController } from '../controllers/SearchController.js';
import { authenticate, aiRateLimiter } from '../middleware/index.js';
import { validateBody } from '../validators/index.js';
import { searchBodySchema } from '../validators/schemas.js';

const router = Router();

router.use(authenticate);
router.use(aiRateLimiter);

router.post('/', validateBody(searchBodySchema), searchController.search);

export default router;
