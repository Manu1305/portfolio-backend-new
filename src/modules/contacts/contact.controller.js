import { listContacts } from './contact.service.js';

export async function getContacts(req, res, next) {
  try {
    const contacts = await listContacts();
    res.json({ contacts });
  } catch (err) {
    next(err);
  }
}
