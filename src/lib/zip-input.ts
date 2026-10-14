/**
 * Attributes for every ZIP code input. They keep password managers (1Password, LastPass, Bitwarden and
 * similar) from putting their icon in the field. `autoComplete` stays on, so browsers still offer saved ZIPs.
 */
export const passwordManagerOffAttrs = {
  'data-1p-ignore': true,
  'data-lpignore': 'true',
  'data-bwignore': true,
  'data-form-type': 'other',
} as const;

export const zipInputAttrs = { inputMode: 'numeric', ...passwordManagerOffAttrs } as const;
