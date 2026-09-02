import { query } from '../../db/pool.js';
import { ApiError } from '../../utils/ApiError.js';

const VAX_COLUMNS = `
  id, animal_id, vaccine_name, due_date, reminder_date, administered_date,
  status, notes, created_at, updated_at
`;

// Static suggestion map for common vaccines in the Ekiti region.
export const VACCINE_SUGGESTIONS = {
  DOG: ['Anti-Rabies', 'DHPP'],
  CAT: ['Anti-Rabies', 'FVRCP'],
  POULTRY: ['Newcastle Disease', 'Gumboro (IBD)', 'Fowl Pox'],
  CATTLE: ['FMD', 'Anthrax', 'Blackleg'],
  GOAT: ['PPR', 'Anthrax'],
  SHEEP: ['PPR', 'Anthrax'],
  RABBIT: ['RHD'],
  OTHER: [],
};

export function getSuggestions(species) {
  if (species) return { [species]: VACCINE_SUGGESTIONS[species] ?? [] };
  return VACCINE_SUGGESTIONS;
}

/** Derive a status from due_date vs today (ignores explicitly COMPLETED rows). */
export function deriveStatus(row, today = new Date().toISOString().slice(0, 10)) {
  if (row.status === 'COMPLETED' || row.administered_date) return 'COMPLETED';
  const due = String(row.due_date).slice(0, 10);
  if (due < today) return 'OVERDUE';
  if (due === today) return 'DUE';
  return 'UPCOMING';
}

function withDerivedStatus(rows) {
  const today = new Date().toISOString().slice(0, 10);
  return rows.map((r) => ({ ...r, derived_status: deriveStatus(r, today) }));
}

/** Confirm the animal exists and belongs to the owner. */
async function assertAnimalOwned(animalId, ownerId) {
  const { rows } = await query('SELECT owner_id FROM animals WHERE id = $1', [animalId]);
  if (!rows[0]) throw ApiError.notFound('Animal not found');
  if (rows[0].owner_id !== ownerId) throw ApiError.notFound('Animal not found');
}

/** List vaccinations for one owned animal. */
export async function listForAnimal(animalId, ownerId) {
  await assertAnimalOwned(animalId, ownerId);
  const { rows } = await query(
    `SELECT ${VAX_COLUMNS} FROM vaccinations WHERE animal_id = $1 ORDER BY due_date ASC`,
    [animalId]
  );
  return withDerivedStatus(rows);
}

/** All due/upcoming vaccinations across an owner's animals (dashboard reminders). */
export async function listDueForOwner(ownerId) {
  const { rows } = await query(
    `SELECT v.id, v.animal_id, v.vaccine_name, v.due_date, v.reminder_date,
            v.administered_date, v.status, v.notes, v.created_at, v.updated_at,
            an.name AS animal_name
     FROM vaccinations v
     JOIN animals an ON an.id = v.animal_id
     WHERE an.owner_id = $1
       AND v.administered_date IS NULL
       AND v.status <> 'COMPLETED'
     ORDER BY v.due_date ASC`,
    [ownerId]
  );
  return withDerivedStatus(rows);
}

export async function createVaccination(ownerId, data) {
  await assertAnimalOwned(data.animal_id, ownerId);

  // Default reminder_date to due_date minus 7 days when omitted.
  let reminder = data.reminder_date ?? null;
  if (!reminder) {
    const d = new Date(`${data.due_date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7);
    reminder = d.toISOString().slice(0, 10);
  }

  const status = data.status ?? deriveStatus({ due_date: data.due_date, administered_date: data.administered_date });

  const { rows } = await query(
    `INSERT INTO vaccinations
       (animal_id, vaccine_name, due_date, reminder_date, administered_date, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING ${VAX_COLUMNS}`,
    [
      data.animal_id,
      data.vaccine_name,
      data.due_date,
      reminder,
      data.administered_date ?? null,
      status,
      data.notes ?? null,
    ]
  );
  return { ...rows[0], derived_status: deriveStatus(rows[0]) };
}

const UPDATABLE = [
  'vaccine_name', 'due_date', 'reminder_date', 'administered_date', 'status', 'notes',
];

/** Update a vaccination owned (via animal) by the user. */
export async function updateVaccination(id, ownerId, data) {
  const owned = await query(
    `SELECT v.id FROM vaccinations v
     JOIN animals an ON an.id = v.animal_id
     WHERE v.id = $1 AND an.owner_id = $2`,
    [id, ownerId]
  );
  if (!owned.rows[0]) throw ApiError.notFound('Vaccination not found');

  const sets = [];
  const params = [];
  for (const col of UPDATABLE) {
    if (data[col] !== undefined) {
      params.push(data[col]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (!sets.length) throw ApiError.badRequest('No updatable fields provided');

  params.push(id);
  const { rows } = await query(
    `UPDATE vaccinations SET ${sets.join(', ')} WHERE id = $${params.length}
     RETURNING ${VAX_COLUMNS}`,
    params
  );
  return { ...rows[0], derived_status: deriveStatus(rows[0]) };
}

export async function deleteVaccination(id, ownerId) {
  const { rowCount } = await query(
    `DELETE FROM vaccinations v
     USING animals an
     WHERE v.id = $1 AND an.id = v.animal_id AND an.owner_id = $2`,
    [id, ownerId]
  );
  if (!rowCount) throw ApiError.notFound('Vaccination not found');
}
