import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  listContactLists,
  getContactList,
  createContactList,
  updateContactList,
  deleteContactList,
  addMembers,
  removeMember,
  duplicateList,
} from '../controllers/contact-lists.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', listContactLists);
router.post('/', createContactList);
router.get('/:id', getContactList);
router.put('/:id', updateContactList);
router.delete('/:id', deleteContactList);

router.post('/:id/members', addMembers);
router.delete('/:id/members/:memberId', removeMember);
router.post('/:id/duplicate', duplicateList);

export default router;
