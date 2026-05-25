import { Router } from 'express';
import { jwtAuth } from '../../middleware/jwt.js';
import { list, getOne, create, update, remove, preview } from '../../controllers/admin/templates.controller.js';

const router = Router();

router.use(jwtAuth);

router.get('/', list);
router.post('/', create);
router.get('/:id', getOne);
router.patch('/:id', update);
router.delete('/:id', remove);
router.post('/:id/preview', preview);

export default router;
