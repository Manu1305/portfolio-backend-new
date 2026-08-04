import Contact from './contact.model.js';

export async function saveContact({ name, address, email, phone }) {
  const contact = await Contact.create({ name, address, email, phone });
  return contact;
}

export async function listContacts() {
  return Contact.find().sort({ createdAt: -1 });
}
