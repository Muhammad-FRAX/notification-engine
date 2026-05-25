import { Router } from 'express';
import authRouter from './auth.routes.js';
import proxyAccountRouter from './proxyAccount.routes.js';
import sourcesRouter from './sources.routes.js';
import recipientsRouter from './recipients.routes.js';
import groupsRouter from './groups.routes.js';
import templatesRouter from './templates.routes.js';
import rulesRouter from './rules.routes.js';
import auditRouter from './audit.routes.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/proxy-account', proxyAccountRouter);
router.use('/sources', sourcesRouter);
router.use('/recipients', recipientsRouter);
router.use('/groups', groupsRouter);
router.use('/templates', templatesRouter);
router.use('/rules', rulesRouter);
router.use('/', auditRouter);

export default router;
