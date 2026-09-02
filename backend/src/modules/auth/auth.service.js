import { query } from '../../db/pool.js';
import { ApiError } from '../../utils/ApiError.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { signToken, signResetToken, verifyToken } from '../../utils/jwt.js';
import { sendEmail } from '../../utils/mailer.js';
import { env } from '../../config/env.js';

/** Strip sensitive columns before a user object leaves the API. */
export function sanitizeUser(user) {
  if (!user) return user;
  const { password_hash, reset_token, reset_token_expires, ...safe } = user;
  return safe;
}

const issueToken = (user) => signToken({ sub: user.id, role: user.role });

export async function register({ full_name, email, phone, password, role, location }) {
  const exists = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
  if (exists.rows.length) throw ApiError.conflict('An account with this email already exists');

  const password_hash = await hashPassword(password);
  const finalRole = role === 'CLINIC_ADMIN' ? 'CLINIC_ADMIN' : 'OWNER';

  const { rows } = await query(
    `INSERT INTO users (full_name, email, phone, password_hash, role, location)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [full_name, email, phone || null, password_hash, finalRole, location || null]
  );
  const user = rows[0];
  return { token: issueToken(user), user: sanitizeUser(user) };
}

export async function login({ email, password }) {
  const { rows } = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
  const user = rows[0];
  if (!user) throw ApiError.unauthorized('Invalid email or password');
  if (!user.is_active) throw ApiError.forbidden('Account is disabled');

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) throw ApiError.unauthorized('Invalid email or password');

  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
  return { token: issueToken(user), user: sanitizeUser(user) };
}

export async function forgotPassword({ email }) {
  const { rows } = await query('SELECT id, email, full_name FROM users WHERE LOWER(email) = LOWER($1)', [email]);
  const user = rows[0];
  // Always behave the same way to avoid user enumeration.
  if (user) {
    const token = signResetToken({ sub: user.id });
    await query(
      `UPDATE users SET reset_token = $1, reset_token_expires = NOW() + INTERVAL '1 hour' WHERE id = $2`,
      [token, user.id]
    );
    const link = `${env.clientUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await sendEmail({
      to: user.email,
      userId: user.id,
      subject: 'Reset your VetConnect Ekiti password',
      html: `<p>Hello ${user.full_name},</p>
             <p>We received a request to reset your password. This link is valid for one hour:</p>
             <p><a href="${link}">${link}</a></p>
             <p>If you did not request this, you can safely ignore this email.</p>`,
      text: `Reset your password using this link (valid 1 hour): ${link}`,
    });
  }
}

export async function resetPassword({ token, password }) {
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    throw ApiError.badRequest('Invalid or expired reset token');
  }

  const { rows } = await query(
    `SELECT * FROM users
     WHERE id = $1 AND reset_token = $2 AND reset_token_expires > NOW()`,
    [decoded.sub, token]
  );
  const user = rows[0];
  if (!user) throw ApiError.badRequest('Invalid or expired reset token');

  const password_hash = await hashPassword(password);
  await query(
    `UPDATE users
     SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL
     WHERE id = $2`,
    [password_hash, user.id]
  );
}

export async function getMe(userId) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
  if (!rows[0]) throw ApiError.notFound('User not found');
  return sanitizeUser(rows[0]);
}
