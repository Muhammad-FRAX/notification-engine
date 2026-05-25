import { Router } from 'express';
import { jwtAuth } from '../../middleware/jwt.js';
import { getStatus, startSignIn, signOutHandler } from '../../controllers/admin/proxyAccount.controller.js';

const router = Router();

router.get('/', jwtAuth, getStatus);
router.post('/sign-in', jwtAuth, startSignIn);
router.post('/sign-out', jwtAuth, signOutHandler);

export default router;
