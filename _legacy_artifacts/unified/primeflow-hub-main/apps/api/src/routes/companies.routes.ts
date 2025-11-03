import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  getCompanyContacts,
  addCompanyContact,
  removeCompanyContact,
} from '../controllers/companies.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', listCompanies);
router.post('/', createCompany);
router.get('/:id', getCompany);
router.put('/:id', updateCompany);
router.delete('/:id', deleteCompany);

router.get('/:id/contacts', getCompanyContacts);
router.post('/:id/contacts', addCompanyContact);
router.delete('/:id/contacts/:contactId', removeCompanyContact);

export default router;
