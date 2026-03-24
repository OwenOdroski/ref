const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlToBytes(b64url) {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

function bytesToB64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBytes(len) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return arr;
}

// 1) Register a passkey and ask for PRF support
async function registerPasskey(username) {
  const userId = randomBytes(16);
  const challenge = randomBytes(32);

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "My App", id: location.hostname },
      user: {
        id: userId,
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      timeout: 60000,
      attestation: "none",
      extensions: {
        prf: {
          eval: {
            first: enc.encode("my-app-master-key-v1"),
          },
        },
      },
    },
  });

  const ext = credential.getClientExtensionResults?.() ?? {};
  const prfEnabled = !!ext.prf?.enabled;

  const record = {
    username,
    credentialId: bytesToB64url(new Uint8Array(credential.rawId)),
    prfEnabled,
  };

  localStorage.setItem("passkeyRecord", JSON.stringify(record));
  return record;
}

// 2) Authenticate and ask PRF for the same secret again
async function getPrfSecret() {
  const record = JSON.parse(localStorage.getItem("passkeyRecord") || "null");
  if (!record) throw new Error("No passkey record found.");

  const challenge = randomBytes(32);
  const credId = b64urlToBytes(record.credentialId);

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: location.hostname,
      allowCredentials: [{ id: credId, type: "public-key" }],
      userVerification: "preferred",
      timeout: 60000,
      extensions: {
        prf: {
          evalByCredential: {
            [record.credentialId]: {
              first: enc.encode("my-app-master-key-v1"),
            },
          },
        },
      },
    },
  });

  const ext = assertion.getClientExtensionResults?.() ?? {};
  const prfOut = ext.prf?.results?.first;

  if (!prfOut) {
    throw new Error("PRF output not available on this authenticator/browser.");
  }

  return prfOut; // ArrayBuffer of secret material
}

// 3) Turn PRF output into an AES-GCM key
async function importAesKeyFromPrf(prfBuffer) {
  const hkdfBaseKey = await crypto.subtle.importKey(
    "raw",
    prfBuffer,
    "HKDF",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: enc.encode("my-app-salt-v1"),
      info: enc.encode("my-app-aes-key"),
    },
    hkdfBaseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// 4) Encrypt JSON for storage
async function encryptJsonWithPasskey(jsonObject) {
  const prfSecret = await getPrfSecret();
  const aesKey = await importAesKeyFromPrf(prfSecret);

  const iv = randomBytes(12);
  const plaintext = enc.encode(JSON.stringify(jsonObject));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    plaintext
  );

  return {
    iv: bytesToB64url(iv),
    data: bytesToB64url(new Uint8Array(ciphertext)),
  };
}

// 5) Decrypt JSON after Face ID / Touch ID / passcode
async function decryptJsonWithPasskey(savedBlob) {
  const prfSecret = await getPrfSecret();
  const aesKey = await importAesKeyFromPrf(prfSecret);

  const iv = b64urlToBytes(savedBlob.iv);
  const data = b64urlToBytes(savedBlob.data);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    data
  );

  return JSON.parse(dec.decode(plaintext));
}


// ----- SECURITY ------
async function decryptAES(base64Data, password) {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  try {
    const combined = base64ToBytes(base64Data);

    // Basic sanity checks (helps catch wrong file / truncated data)
    if (combined.length < 16 + 12 + 1) {
      return { ok: false, reason: "bad_format", error: "Too short" };
    }

    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const ciphertext = combined.slice(28);

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    // If password wrong OR data tampered/corrupted -> this throws
    const decryptedBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );

    const text = dec.decode(decryptedBuf);

    // If you expect JSON, parse it; JSON parse failure is NOT a crypto failure
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch {
      return { ok: true, value: text, warning: "not_json" };
    }
  } catch (err) {
    // AES-GCM failures (wrong password / tamper / corrupt) land here
    // In most browsers it's DOMException: OperationError
    return {
      ok: false,
      reason: "decrypt_failed",
      errorName: err?.name || "Error",
      errorMessage: err?.message || String(err)
    };
  }
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
