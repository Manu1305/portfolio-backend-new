import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// verifies a Google ID token (from the frontend's "Sign in with Google" flow)
// and returns the verified payload, or throws if invalid/expired/wrong audience
export async function verifyGoogleIdToken(idToken) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    const err = new Error('Server misconfiguration: GOOGLE_CLIENT_ID is not set');
    err.status = 500;
    throw err;
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  return ticket.getPayload();
}
