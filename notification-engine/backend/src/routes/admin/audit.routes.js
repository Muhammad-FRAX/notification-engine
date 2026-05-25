import { Router } from 'express';
import { jwtAuth } from '../../middleware/jwt.js';
import {
  list,
  getOne,
  retryNotification,
  retryDelivery,
  getStats,
} from '../../controllers/admin/audit.controller.js';

const router = Router();
router.use(jwtAuth);

router.get('/notifications', list);
router.get('/notifications/:id', getOne);
router.post('/notifications/:id/retry', retryNotification);
router.post('/deliveries/:id/retry', retryDelivery);
router.get('/stats', getStats);

export default router;
