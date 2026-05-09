export function validatePassword(password: string) {
  const errors: string[] = [];

  if (password.length < 8) errors.push("Use at least 8 characters.");
  if (!/\d/.test(password)) errors.push("Add at least one number.");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Add at least one special character.");

  return {
    valid: errors.length === 0,
    errors
  };
}
