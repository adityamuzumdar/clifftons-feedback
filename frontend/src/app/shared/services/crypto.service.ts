import { Injectable } from '@angular/core';

export interface MemberKeyMaterial {
  publicKeyJwk: JsonWebKey;
  encryptedPrivateKey: string; // base64
  privateKeyIv: string;        // base64
  viewTokenHash: string;       // base64 SHA-256 of viewSecret — for server lookup
  viewSecret: string;          // base64 — shown to user ONCE, never stored on server
}

export interface EncryptedFeedback {
  ephemeralPubKey: string; // JSON string of JWK
  encryptedData: string;   // base64 ciphertext
  iv: string;              // base64
}

@Injectable({ providedIn: 'root' })
export class CryptoService {

  // Called at join time. Generates key pair and wraps private key with viewSecret.
  async generateKeyMaterial(): Promise<MemberKeyMaterial> {
    const viewSecretBytes = crypto.getRandomValues(new Uint8Array(32));
    const viewSecret = this.toBase64(viewSecretBytes);

    // ECDH P-256 key pair
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );

    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    // Encrypt private key with AES-GCM key derived from viewSecret
    const wrapKey = await this.deriveWrapKey(viewSecretBytes);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const privateKeyBytes = new TextEncoder().encode(JSON.stringify(privateKeyJwk));
    const encryptedPrivateBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, privateKeyBytes);

    // SHA-256 of viewSecret — server stores this for lookup, cannot reverse to viewSecret
    const hashBuf = await crypto.subtle.digest('SHA-256', viewSecretBytes);

    return {
      publicKeyJwk,
      encryptedPrivateKey: this.toBase64(new Uint8Array(encryptedPrivateBuf)),
      privateKeyIv: this.toBase64(iv),
      viewTokenHash: this.toBase64(new Uint8Array(hashBuf)),
      viewSecret,
    };
  }

  // Called when submitting feedback for a target member.
  // Uses their public key to encrypt — only they can decrypt.
  async encryptFeedback(data: object, targetPublicKeyJwk: JsonWebKey): Promise<EncryptedFeedback> {
    const targetPubKey = await crypto.subtle.importKey(
      'jwk', targetPublicKeyJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []
    );

    // Ephemeral key pair per encryption — forward secrecy
    const ephemeral = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']
    );

    // ECDH: shared secret → AES-GCM key
    const sharedKey = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: targetPubKey },
      ephemeral.privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedKey, plaintext);

    const ephemeralPubKeyJwk = await crypto.subtle.exportKey('jwk', ephemeral.publicKey);

    return {
      ephemeralPubKey: JSON.stringify(ephemeralPubKeyJwk),
      encryptedData: this.toBase64(new Uint8Array(ciphertext)),
      iv: this.toBase64(iv),
    };
  }

  // Recover private key using viewSecret + the encrypted private key fetched from server.
  async recoverPrivateKey(viewSecret: string, encryptedPrivateKey: string, privateKeyIv: string): Promise<CryptoKey> {
    const viewSecretBytes = this.fromBase64(viewSecret);
    const wrapKey = await this.deriveWrapKey(viewSecretBytes);

    const decryptedBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.fromBase64(privateKeyIv) },
      wrapKey,
      this.fromBase64(encryptedPrivateKey)
    );

    const privateKeyJwk = JSON.parse(new TextDecoder().decode(decryptedBytes));
    return crypto.subtle.importKey(
      'jwk', privateKeyJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey', 'deriveBits']
    );
  }

  // Decrypt a single feedback blob using the member's private key.
  async decryptFeedback(encrypted: EncryptedFeedback, privateKey: CryptoKey): Promise<any> {
    const ephemeralPubKey = await crypto.subtle.importKey(
      'jwk', JSON.parse(encrypted.ephemeralPubKey), { name: 'ECDH', namedCurve: 'P-256' }, false, []
    );

    const sharedKey = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: ephemeralPubKey },
      privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.fromBase64(encrypted.iv) },
      sharedKey,
      this.fromBase64(encrypted.encryptedData)
    );

    return JSON.parse(new TextDecoder().decode(plaintext));
  }

  // Derives AES-GCM key from viewSecret bytes using HKDF
  private async deriveWrapKey(viewSecretBytes: Uint8Array): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey('raw', viewSecretBytes, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(16),
        info: new TextEncoder().encode('wrap-private-key'),
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  toBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
  }

  fromBase64(str: string): Uint8Array {
    return new Uint8Array(atob(str).split('').map((c) => c.charCodeAt(0)));
  }
}
