import { listPeople, addPerson } from './people.service.js';

function validatePayload(body) {
  const { name } = body;
  if (typeof name !== 'string' || name.trim().length === 0) {
    return 'name is required';
  }
  if (name.length > 200) return 'name must be 200 characters or fewer';

  if (body.age !== undefined && body.age !== null && body.age !== '' && typeof body.age !== 'number') {
    return 'age must be a number';
  }
  if (body.notes && body.notes.length > 5000) return 'notes must be 5000 characters or fewer';

  return null;
}

export async function listPeopleHandler(req, res, next) {
  try {
    const people = await listPeople();
    res.json({ people });
  } catch (err) {
    next(err);
  }
}

export async function addPersonHandler(req, res, next) {
  try {
    const error = validatePayload(req.body || {});
    if (error) return res.status(400).json({ error });

    const person = await addPerson(req.body);
    res.status(201).json({ person });
  } catch (err) {
    next(err);
  }
}
