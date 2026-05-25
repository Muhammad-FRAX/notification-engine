import argon2 from 'argon2';

export async function hashApiKey(plaintext) {
  return argon2.hash(plaintext);
}

export async function verifyApiKey(hash, plaintext) {
  return argon2.verify(hash, plaintext);
}
