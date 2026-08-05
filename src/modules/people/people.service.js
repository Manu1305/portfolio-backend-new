import Person from './people.model.js';

export async function listPeople() {
  return Person.find().sort({ createdAt: -1 });
}

export async function addPerson(data) {
  return Person.create(data);
}
