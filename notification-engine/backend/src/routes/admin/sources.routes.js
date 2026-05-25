import { Router } from 'express';
import { jwtAuth } from '../../middleware/jwt.js';
import { list, getOne, create, update, remove } from '../../controllers/admin/sources.controller.js';

const router = Router();

router.use(jwtAuth);

router.get('/', list);
router.post('/', create);
router.get('/:id', getOne);
router.patch('/:id', update);
router.delete('/:id', remove);

export default router;
