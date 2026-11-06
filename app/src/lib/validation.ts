import { z } from "zod";

/**
 * Numéro de téléphone saisi par un humain : « + » facultatif, chiffres et espaces, 8 à 15 chiffres (norme E.164),
 * 20 caractères au plus (limite stockée en base). Exemple valide : « +225 07 07 07 07 07 ».
 */
export function isValidPhone(value: string): boolean {
  const v = value.trim();
  if (v.length > 20 || !/^\+?[0-9 ]+$/.test(v)) return false;
  const digits = v.replace(/\D/g, "").length;
  return digits >= 8 && digits <= 15;
}

const MESSAGE = "Numéro de téléphone invalide (ex. +225 07 07 07 07 07)";

/** Téléphone obligatoire. */
export const requiredPhone = (requiredMessage = "Téléphone requis") =>
  z.string().trim().min(1, requiredMessage).refine(isValidPhone, MESSAGE);

/** Téléphone facultatif : une chaîne vide devient `undefined`. */
export const optionalPhone = () =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || isValidPhone(v), MESSAGE)
    .optional()
    .transform((v) => (v ? v : undefined));
