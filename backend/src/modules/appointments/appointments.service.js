import { query, withTransaction } from '../../db/pool.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendEmail } from '../../utils/mailer.js';
import { dateKey, computeSlots } from '../availability/availability.service.js';

const APPT_SELECT = `
  a.id, a.clinic_id, a.owner_id, a.animal_id, a.vet_id, a.slot_id,
  a.service, a.scheduled_date, a.start_time, a.end_time, a.status,
  a.notes, a.reject_reason, a.created_at, a.updated_at,
  an.name AS animal_name, c.name AS clinic_name
`;

const APPT_JOINS = `
  FROM appointments a
  JOIN animals an ON an.id = a.animal_id
  JOIN clinics c  ON c.id = a.clinic_id
`;

async function fetchById(id) {
  const { rows } = await query(`SELECT ${APPT_SELECT} ${APPT_JOINS} WHERE a.id = $1`, [id]);
  return rows[0] || null;
}

/** Verify a (date,start_time) is bookable for a clinic using the availability rules. */
async function assertSlotBookable(clinicId, dateStr, startTime, client) {
  const run = client ? client.query.bind(client) : query;
  const start5 = String(startTime).slice(0, 5);

  // Re-check live appointments inside the transaction.
  const clash = await run(
    `SELECT 1 FROM appointments
     WHERE clinic_id = $1 AND scheduled_date = $2 AND start_time = $3
       AND status IN ('PENDING','CONFIRMED')
     LIMIT 1`,
    [clinicId, dateStr, start5]
  );
  if (clash.rows.length) throw ApiError.conflict('Slot no longer available');

  // Confirm the slot exists in the clinic's published availability (not blocked, valid time).
  const slots = await computeSlots(clinicId, dateStr);
  const match = slots.find((s) => s.start_time === start5);
  if (!match) throw ApiError.badRequest('Requested time is outside the clinic schedule');
  if (!match.available) throw ApiError.conflict('Slot no longer available');
  return match.end_time;
}

/** Book an appointment. Returns the created row (with joins). */
export async function bookAppointment(owner, data) {
  const dateStr = dateKey(data.scheduled_date);

  const appt = await withTransaction(async (client) => {
    // 1. Animal must belong to the owner.
    const animalRes = await client.query(
      'SELECT id, owner_id FROM animals WHERE id = $1',
      [data.animal_id]
    );
    if (!animalRes.rows[0]) throw ApiError.notFound('Animal not found');
    if (animalRes.rows[0].owner_id !== owner.id) {
      throw ApiError.forbidden('You do not own this animal');
    }

    // 2. Clinic must be APPROVED.
    const clinicRes = await client.query(
      'SELECT id, status FROM clinics WHERE id = $1',
      [data.clinic_id]
    );
    if (!clinicRes.rows[0]) throw ApiError.notFound('Clinic not found');
    if (clinicRes.rows[0].status !== 'APPROVED') {
      throw ApiError.badRequest('Clinic is not accepting bookings');
    }

    // 3. Validate the slot + compute end_time.
    const endTime = await assertSlotBookable(data.clinic_id, dateStr, data.start_time, client);
    const start5 = String(data.start_time).slice(0, 5);

    // 4. Reserve an appointment_slots row (best-effort, enforces no double booking).
    let slotId = null;
    try {
      const slotRes = await client.query(
        `INSERT INTO appointment_slots (clinic_id, vet_id, slot_date, start_time, end_time, is_booked)
         VALUES ($1,$2,$3,$4,$5,TRUE)
         ON CONFLICT (clinic_id, vet_id, slot_date, start_time)
         DO UPDATE SET is_booked = TRUE
           WHERE appointment_slots.is_booked = FALSE
         RETURNING id`,
        [data.clinic_id, data.vet_id ?? null, dateStr, start5, endTime]
      );
      if (!slotRes.rows[0]) throw ApiError.conflict('Slot no longer available');
      slotId = slotRes.rows[0].id;
    } catch (err) {
      if (err.code === '23505') throw ApiError.conflict('Slot no longer available');
      throw err;
    }

    // 5. Insert the appointment.
    const insertRes = await client.query(
      `INSERT INTO appointments
         (clinic_id, owner_id, animal_id, vet_id, slot_id, service,
          scheduled_date, start_time, end_time, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING',$10)
       RETURNING id`,
      [
        data.clinic_id,
        owner.id,
        data.animal_id,
        data.vet_id ?? null,
        slotId,
        data.service,
        dateStr,
        start5,
        endTime,
        data.notes ?? null,
      ]
    );
    return insertRes.rows[0].id;
  });

  const row = await fetchById(appt);

  // Booking-received confirmation email (best-effort).
  await sendEmail({
    to: owner.email,
    userId: owner.id,
    subject: 'Appointment request received — VetConnect Ekiti',
    text: `Hi ${owner.full_name},\n\nWe received your booking request for "${row.service}" at ${row.clinic_name} on ${dateStr} at ${String(row.start_time).slice(0, 5)}. Status: PENDING. You will be notified once the clinic confirms.`,
    payload: { appointment_id: row.id, type: 'booking_received' },
  }).catch(() => {});

  return row;
}

/** Role-aware paginated list. */
export async function listAppointments(user, filters, limit, offset) {
  const where = [];
  const params = [];

  if (user.role === 'OWNER') {
    params.push(user.id);
    where.push(`a.owner_id = $${params.length}`);
  } else if (user.role === 'CLINIC_ADMIN') {
    params.push(user.id);
    where.push(`c.owner_id = $${params.length}`);
  } // SUPER_ADMIN: no scope filter.

  if (filters.status) {
    params.push(filters.status);
    where.push(`a.status = $${params.length}`);
  }
  if (filters.date) {
    params.push(filters.date);
    where.push(`a.scheduled_date = $${params.length}`);
  }
  if (filters.clinic_id) {
    params.push(filters.clinic_id);
    where.push(`a.clinic_id = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countRes = await query(
    `SELECT COUNT(*)::int AS total ${APPT_JOINS} ${whereSql}`,
    params
  );
  const total = countRes.rows[0].total;

  params.push(limit, offset);
  const { rows } = await query(
    `SELECT ${APPT_SELECT} ${APPT_JOINS} ${whereSql}
     ORDER BY a.scheduled_date DESC, a.start_time DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { rows, total };
}

/** Fetch one appointment if the user is a participant. */
export async function getAppointmentForUser(id, user) {
  const row = await fetchById(id);
  if (!row) throw ApiError.notFound('Appointment not found');
  await assertParticipant(row, user);
  return row;
}

async function clinicOwnerId(clinicId) {
  const { rows } = await query('SELECT owner_id FROM clinics WHERE id = $1', [clinicId]);
  return rows[0]?.owner_id ?? null;
}

async function assertParticipant(appt, user) {
  if (user.role === 'SUPER_ADMIN') return;
  if (user.role === 'OWNER' && appt.owner_id === user.id) return;
  if (user.role === 'CLINIC_ADMIN' && (await clinicOwnerId(appt.clinic_id)) === user.id) return;
  throw ApiError.forbidden('You are not a participant in this appointment');
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------
const TERMINAL = new Set(['COMPLETED', 'CANCELLED', 'NO_SHOW']);

/** Free the reserved slot for an appointment (on cancel/reject). */
async function freeSlot(client, appt) {
  if (appt.slot_id) {
    await client.query('UPDATE appointment_slots SET is_booked = FALSE WHERE id = $1', [appt.slot_id]);
  }
}

export async function patchAppointment(id, user, input) {
  const updated = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT a.*, c.owner_id AS clinic_owner_id
       FROM appointments a JOIN clinics c ON c.id = a.clinic_id
       WHERE a.id = $1 FOR UPDATE OF a`,
      [id]
    );
    const appt = rows[0];
    if (!appt) throw ApiError.notFound('Appointment not found');

    const isOwner = user.role === 'OWNER' && appt.owner_id === user.id;
    const isClinic =
      (user.role === 'CLINIC_ADMIN' && appt.clinic_owner_id === user.id) ||
      user.role === 'SUPER_ADMIN';
    if (!isOwner && !isClinic) {
      throw ApiError.forbidden('You may not modify this appointment');
    }

    const { action } = input;

    // Owner-permitted actions.
    const ownerActions = new Set(['cancel', 'reschedule']);
    // Clinic-permitted actions.
    const clinicActions = new Set(['confirm', 'reject', 'complete', 'no_show', 'reschedule']);

    if (isOwner && !ownerActions.has(action)) {
      throw ApiError.forbidden(`Owners may not perform "${action}"`);
    }
    if (!isOwner && isClinic && !clinicActions.has(action)) {
      throw ApiError.forbidden(`Clinic admins may not perform "${action}"`);
    }

    if (TERMINAL.has(appt.status) && action !== 'cancel') {
      // No further transitions out of a terminal state (cancel of a terminal is a no-op-error).
      throw ApiError.conflict(`Cannot ${action} an appointment that is ${appt.status}`);
    }

    let emailKind = null;

    switch (action) {
      case 'cancel': {
        if (appt.status === 'CANCELLED') throw ApiError.conflict('Already cancelled');
        if (appt.status === 'COMPLETED') throw ApiError.conflict('Cannot cancel a completed appointment');
        await client.query(`UPDATE appointments SET status='CANCELLED' WHERE id=$1`, [id]);
        await freeSlot(client, appt);
        break;
      }
      case 'reject': {
        if (appt.status !== 'PENDING' && appt.status !== 'CONFIRMED') {
          throw ApiError.conflict(`Cannot reject an appointment that is ${appt.status}`);
        }
        await client.query(
          `UPDATE appointments SET status='CANCELLED', reject_reason=$2 WHERE id=$1`,
          [id, input.reject_reason ?? null]
        );
        await freeSlot(client, appt);
        emailKind = 'reject';
        break;
      }
      case 'confirm': {
        if (appt.status !== 'PENDING') {
          throw ApiError.conflict('Only PENDING appointments can be confirmed');
        }
        await client.query(`UPDATE appointments SET status='CONFIRMED' WHERE id=$1`, [id]);
        emailKind = 'confirm';
        break;
      }
      case 'complete': {
        if (appt.status !== 'CONFIRMED' && appt.status !== 'PENDING') {
          throw ApiError.conflict(`Cannot complete an appointment that is ${appt.status}`);
        }
        await client.query(`UPDATE appointments SET status='COMPLETED' WHERE id=$1`, [id]);
        break;
      }
      case 'no_show': {
        if (appt.status !== 'CONFIRMED' && appt.status !== 'PENDING') {
          throw ApiError.conflict(`Cannot mark NO_SHOW on an appointment that is ${appt.status}`);
        }
        await client.query(`UPDATE appointments SET status='NO_SHOW' WHERE id=$1`, [id]);
        await freeSlot(client, appt);
        break;
      }
      case 'reschedule': {
        if (appt.status !== 'PENDING' && appt.status !== 'CONFIRMED') {
          throw ApiError.conflict(`Cannot reschedule an appointment that is ${appt.status}`);
        }
        const newDate = dateKey(input.scheduled_date);
        const newStart = String(input.start_time).slice(0, 5);

        // Validate the new slot (ignoring this appointment's own current hold).
        const clash = await client.query(
          `SELECT 1 FROM appointments
           WHERE clinic_id=$1 AND scheduled_date=$2 AND start_time=$3
             AND status IN ('PENDING','CONFIRMED') AND id <> $4
           LIMIT 1`,
          [appt.clinic_id, newDate, newStart, id]
        );
        if (clash.rows.length) throw ApiError.conflict('Slot no longer available');

        const slots = await computeSlots(appt.clinic_id, newDate);
        const match = slots.find((s) => s.start_time === newStart);
        if (!match) throw ApiError.badRequest('Requested time is outside the clinic schedule');
        // Treat the appointment's own slot as available to itself.
        if (!match.available) {
          const ownHold =
            String(appt.scheduled_date).slice(0, 10) === newDate &&
            String(appt.start_time).slice(0, 5) === newStart;
          if (!ownHold) throw ApiError.conflict('Slot no longer available');
        }

        // Release old slot reservation, reserve the new one.
        await freeSlot(client, appt);
        let newSlotId = null;
        const slotRes = await client.query(
          `INSERT INTO appointment_slots (clinic_id, vet_id, slot_date, start_time, end_time, is_booked)
           VALUES ($1,$2,$3,$4,$5,TRUE)
           ON CONFLICT (clinic_id, vet_id, slot_date, start_time)
           DO UPDATE SET is_booked = TRUE
             WHERE appointment_slots.is_booked = FALSE
           RETURNING id`,
          [appt.clinic_id, appt.vet_id ?? null, newDate, newStart, match.end_time]
        );
        newSlotId = slotRes.rows[0]?.id ?? null;

        await client.query(
          `UPDATE appointments
           SET scheduled_date=$2, start_time=$3, end_time=$4, status='PENDING', slot_id=$5
           WHERE id=$1`,
          [id, newDate, newStart, match.end_time, newSlotId]
        );
        emailKind = 'reschedule';
        break;
      }
      default:
        throw ApiError.badRequest('Unknown action');
    }

    return { emailKind };
  });

  const row = await fetchById(id);

  // Notify the owner on confirm / reject / reschedule.
  if (updated.emailKind) {
    const ownerRes = await query('SELECT email, full_name FROM users WHERE id = $1', [row.owner_id]);
    const ownerUser = ownerRes.rows[0];
    if (ownerUser) {
      const when = `${String(row.scheduled_date).slice(0, 10)} at ${String(row.start_time).slice(0, 5)}`;
      const subjects = {
        confirm: 'Appointment confirmed — VetConnect Ekiti',
        reject: 'Appointment declined — VetConnect Ekiti',
        reschedule: 'Appointment rescheduled — VetConnect Ekiti',
      };
      const bodies = {
        confirm: `Hi ${ownerUser.full_name},\n\nYour appointment for "${row.service}" at ${row.clinic_name} on ${when} has been CONFIRMED.`,
        reject: `Hi ${ownerUser.full_name},\n\nYour appointment for "${row.service}" at ${row.clinic_name} was declined.${row.reject_reason ? `\nReason: ${row.reject_reason}` : ''}`,
        reschedule: `Hi ${ownerUser.full_name},\n\nYour appointment for "${row.service}" at ${row.clinic_name} is now scheduled for ${when} (status PENDING).`,
      };
      await sendEmail({
        to: ownerUser.email,
        userId: row.owner_id,
        subject: subjects[updated.emailKind],
        text: bodies[updated.emailKind],
        payload: { appointment_id: row.id, type: updated.emailKind },
      }).catch(() => {});
    }
  }

  return row;
}
