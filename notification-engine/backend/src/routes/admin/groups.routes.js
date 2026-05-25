import { Router } from 'express';
import { jwtAuth } from '../../middleware/jwt.js';
import { list, getOne, create, update, remove, addMember, removeMember } from '../../controllers/admin/groups.controller.js';

const router = Router();

router.use(jwtAuth);

router.get('/', list);
router.post('/', create);
router.get('/:id', getOne);
router.patch('/:id', update);
router.delete('/:id', remove);
router.post('/:id/members', addMember);
router.delete('/:id/members/:memberType/:memberId', removeMember);

export default router;
