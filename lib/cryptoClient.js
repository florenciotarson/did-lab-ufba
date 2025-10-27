// lib/cryptoClient.js
// *** USO NO NAVEGADOR *** (WebCrypto). Importe apenas de componentes "use client".
import canonicalize from 'canonicalize';

// Se seu projeto usa ethers v5:
import { ethers } from 'ethers';
// Se estiver em ethers v6, troque a linha acima por:
// import { keccak256, toUtf8Bytes } from 'ethers';

const te = new TextEncoder();
const td = new TextDecoder();

// ---- helpers base64 (browser) ----
function b64(u8) { return btoa(String.fromCharCode(...u8)); }
function b64d(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }

// ---- KDF PBKDF2 -> AES-GCM ----
async function deriveKeyPBKDF2(password, salt, iterations = 150000) {
  // garante que estamos no browser
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto indisponível (este módulo é só para o navegador).');

  const keyMaterial = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ---- hash canônico do JSON (para on-chain) ----
export function computeCanonicalHash(jsonLike) {
  const obj = typeof jsonLike === 'string' ? JSON.parse(jsonLike) : jsonLike;
  const canon = canonicalize(obj);

  // ethers v5:
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(canon));
  // ethers v6 (se usar):
  // return keccak256(toUtf8Bytes(canon));
}

// ---- cifrar JSON com senha do usuário ----
export async function encryptJSON(jsonLike, password, opts = {}) {
  const obj = typeof jsonLike === 'string' ? JSON.parse(jsonLike) : jsonLike;
  const plaintext = te.encode(JSON.stringify(obj));

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = opts.iterations ?? 150000;

  const key = await deriveKeyPBKDF2(password, salt, iterations);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));

  return {
    version: "1.0",
    alg: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations,
    iv: b64(iv),
    salt: b64(salt),
    ciphertext: b64(ct),
  };
}

// ---- descriptografar bundle -> JSON ----
export async function decryptToJSON(bundle, password) {
  const iv = b64d(bundle.iv);
  const salt = b64d(bundle.salt);
  const ct = b64d(bundle.ciphertext);

  const key = await deriveKeyPBKDF2(password, salt, bundle.iterations);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct));
  const jsonStr = td.decode(pt);
  return JSON.parse(jsonStr);
}

/* Opcional (mais forte): Argon2id
   - npm i argon2-browser
   - Troque deriveKeyPBKDF2 por uma versão com Argon2id (memória 64–128MiB, time=3).
*/
