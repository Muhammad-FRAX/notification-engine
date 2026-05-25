import { Router } from 'express';
import { jwtAuth } from '../../middleware/jwt.js';
import { login, me } from '../../controllers/admin/auth.controller.js';

const router = Router();

router.post('/login', login);
router.get('/me', jwtAuth, me);

export default router;
