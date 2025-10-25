import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const PASSWORD_RESET_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds

// ========================================
// PASSWORD HASHING
// ========================================

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

// ========================================
// JWT TOKEN GENERATION
// ========================================

export function generateJWT(payload: any, expiresIn: string = "24h"): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyJWT(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// ========================================
// PASSWORD RESET TOKENS
// ========================================

export function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getPasswordResetTokenExpiry(): Date {
  return new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY);
}

export function isPasswordResetTokenValid(expiresAt: Date): boolean {
  return new Date() < expiresAt;
}

// ========================================
// EMAIL VALIDATION
// ========================================

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ========================================
// PASSWORD STRENGTH VALIDATION
// ========================================

export function isStrongPassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: "A senha deve ter pelo menos 8 caracteres" };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "A senha deve conter pelo menos uma letra maiúscula" };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "A senha deve conter pelo menos uma letra minúscula" };
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "A senha deve conter pelo menos um número" };
  }
  
  return { valid: true, message: "Senha válida" };
}

// ========================================
// OAUTH HELPERS
// ========================================

export interface OAuthProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: "google" | "apple";
}

export function normalizeOAuthProfile(provider: "google" | "apple", profile: any): OAuthProfile {
  switch (provider) {
    case "google":
      return {
        id: profile.id,
        email: profile.emails?.[0]?.value || profile.email,
        name: profile.displayName || profile.name,
        avatar: profile.photos?.[0]?.value || profile.picture,
        provider: "google",
      };
    
    case "apple":
      return {
        id: profile.id,
        email: profile.email,
        name: profile.name?.firstName + " " + profile.name?.lastName || "Apple User",
        avatar: undefined,
        provider: "apple",
      };
    
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
}
