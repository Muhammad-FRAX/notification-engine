import { Router } from 'express';
import authRouter from './auth.routes.js';
import proxyAccountRouter from './proxyAccount.routes.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/proxy-account', proxyAccountRouter);

export default router;
