import { toast } from 'sonner';

/**
 * Field length limits for profile data
 */
export const PROFILE_FIELD_LIMITS: Record<string, number> = {
  display_name: 100,
  headline: 200,
  bio: 2000,
  location: 100,
  role: 100,
  pronouns: 50,
  union_status: 100,
  representation: 200,
};

/**
 * Human-readable field names for error messages
 */
const FIELD_DISPLAY_NAMES: Record<string, string> = {
  display_name: 'Display name',
  headline: 'Headline',
  bio: 'Bio',
  location: 'Location',
  role: 'Role',
  pronouns: 'Pronouns',
  union_status: 'Union status',
  representation: 'Representation',
};

/**
 * Validates a profile field value against length constraints
 * @param field - The field name to validate
 * @param value - The value to validate
 * @param showToast - Whether to show a toast error message (default: true)
 * @returns true if valid, false otherwise
 */
export const validateProfileField = (
  field: string,
  value: string | null | undefined,
  showToast = true
): boolean => {
  if (value === null || value === undefined) {
    return true; // Null/undefined values are allowed (database allows NULL)
  }

  const limit = PROFILE_FIELD_LIMITS[field];
  if (limit && value.length > limit) {
    if (showToast) {
      const displayName = FIELD_DISPLAY_NAMES[field] || field;
      toast.error(`${displayName} must be ${limit} characters or less`);
    }
    return false;
  }
  return true;
};

/**
 * Validates multiple profile fields at once
 * @param fields - Object containing field names and values
 * @returns true if all fields are valid, false otherwise
 */
export const validateProfileFields = (
  fields: Record<string, string | null | undefined>
): boolean => {
  for (const [field, value] of Object.entries(fields)) {
    if (!validateProfileField(field, value)) {
      return false;
    }
  }
  return true;
};

/**
 * Truncates a value to the maximum allowed length for a field
 * @param field - The field name
 * @param value - The value to truncate
 * @returns The truncated value
 */
export const truncateToLimit = (field: string, value: string): string => {
  const limit = PROFILE_FIELD_LIMITS[field];
  if (limit && value.length > limit) {
    return value.slice(0, limit);
  }
  return value;
};
