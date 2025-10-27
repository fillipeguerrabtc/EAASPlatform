import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import type { CookieOptions } from "express";

const SALT_ROUNDS = 10;
const PASSWORD_RESET_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds

// ========================================
// SECRET VALIDATION (CRITICAL SECURITY)
// ========================================
// Validate JWT_SECRET at startup - MUST be strong in production
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "";

if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET or SESSION_SECRET must be set");
}

if (process.env.NODE_ENV === "production" && JWT_SECRET.length < 32) {
  throw new Error(
    `FATAL: JWT_SECRET too weak (${JWT_SECRET.length} chars). ` +
    `Must be at least 32 chars in production. Generate with: openssl rand -hex 32`
  );
}

// Warn in development if secret is too short
if (process.env.NODE_ENV !== "production" && JWT_SECRET.length < 32) {
  console.warn(
    `⚠️  WARNING: JWT_SECRET is weak (${JWT_SECRET.length} chars). ` +
    `Should be at least 32 chars. Generate with: openssl rand -hex 32`
  );
}

// ========================================
// SECURE COOKIE OPTIONS (HARDENED)
// ========================================
export const secureCookieOptions: CookieOptions = {
  httpOnly: true,  // Prevents XSS attacks
  secure: process.env.NODE_ENV === "production",  // HTTPS-only in production
  sameSite: "strict",  // CSRF protection
  maxAge: 24 * 60 * 60 * 1000,  // 24 hours
  path: "/",
};

// ========================================
// LOGIN THROTTLE (IN-MEMORY ANTI BRUTE-FORCE)
// ========================================
// Map: email -> { attempts: number, lockedUntil: Date | null }
const loginAttempts = new Map<string, { attempts: number; lockedUntil: Date | null }>();

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export function checkLoginThrottle(email: string): { allowed: boolean; message?: string; lockedUntil?: Date } {
  const record = loginAttempts.get(email);
  
  if (!record) {
    return { allowed: true };
  }
  
  // Check if account is locked
  if (record.lockedUntil && record.lockedUntil > new Date()) {
    return {
      allowed: false,
      message: `Account temporarily locked. Try again after ${record.lockedUntil.toISOString()}`,
      lockedUntil: record.lockedUntil,
    };
  }
  
  // Reset if lockout expired
  if (record.lockedUntil && record.lockedUntil <= new Date()) {
    loginAttempts.delete(email);
    return { allowed: true };
  }
  
  return { allowed: true };
}

export function recordLoginFailure(email: string): void {
  const record = loginAttempts.get(email) || { attempts: 0, lockedUntil: null };
  
  record.attempts += 1;
  
  if (record.attempts >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION);
    console.warn({ email, attempts: record.attempts, lockedUntil: record.lockedUntil }, "Login throttle: Account locked");
  }
  
  loginAttempts.set(email, record);
}

export function resetLoginFailures(email: string): void {
  loginAttempts.delete(email);
}

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
// PASSWORD RESET TOKENS (SINGLE-USE SYSTEM)
// ========================================
// Set of used tokens - prevents token replay attacks
const usedPasswordResetTokens = new Set<string>();

export function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getPasswordResetTokenExpiry(): Date {
  return new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY);
}

export function isPasswordResetTokenValid(expiresAt: Date): boolean {
  return new Date() < expiresAt;
}

/**
 * Check if token has already been used (single-use enforcement)
 * Returns { valid: true } if token is unused, { valid: false, message } if already used
 */
export function checkPasswordResetTokenUsage(token: string): { valid: boolean; message?: string } {
  if (usedPasswordResetTokens.has(token)) {
    return {
      valid: false,
      message: "Password reset token has already been used. Request a new one.",
    };
  }
  
  return { valid: true };
}

/**
 * Mark token as used (single-use enforcement)
 * Call this AFTER successful password reset
 */
export function markPasswordResetTokenAsUsed(token: string): void {
  usedPasswordResetTokens.add(token);
  
  // Auto-cleanup after 2 hours (double the token expiry)
  setTimeout(() => {
    usedPasswordResetTokens.delete(token);
  }, PASSWORD_RESET_TOKEN_EXPIRY * 2);
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
