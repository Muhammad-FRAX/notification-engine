import { Router } from 'express';
import { apiKeyAuth } from '../middleware/apiKey.js';
import { postNotification } from '../controllers/notifications.controller.js';

const router = Router();

router.post('/api/notifications', apiKeyAuth, postNotification);

export default router;
