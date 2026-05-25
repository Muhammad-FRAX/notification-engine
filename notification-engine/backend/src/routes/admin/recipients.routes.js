import { Router } from 'express';
import { jwtAuth } from '../../middleware/jwt.js';
import {
  listUsers, getUser, createUser, updateUser, removeUser,
  listChannels, getChannel, createChannel, updateChannel, removeChannel,
} from '../../controllers/admin/recipients.controller.js';

const router = Router();

router.use(jwtAuth);

router.get('/users', listUsers);
router.post('/users', createUser);
router.get('/users/:id', getUser);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', removeUser);

router.get('/channels', listChannels);
router.post('/channels', createChannel);
router.get('/channels/:id', getChannel);
router.patch('/channels/:id', updateChannel);
router.delete('/channels/:id', removeChannel);

export default router;
