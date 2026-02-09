import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is not defined');
    }
    return Buffer.from(key, 'hex');
}

/**
 * Hash a password using SHA-256 for storage verification
 */
export function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Verify a password against its hash
 */
export function verifyPassword(password: string, hash: string): boolean {
    return hashPassword(password) === hash;
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns: iv:authTag:encrypted (hex encoded)
 */
export function encrypt(text: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with AES-256-GCM
 */
export function decrypt(encryptedData: string): string {
    const key = getEncryptionKey();
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

    if (!ivHex || !authTagHex || !encrypted) {
        throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
