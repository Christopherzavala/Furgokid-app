const UNAUTHENTICATED_CODES = new Set([
  'unauthenticated',
  'functions/unauthenticated',
  'auth/user-token-expired',
  'auth/user-disabled',
  'auth/user-not-found',
]);

/**
 * Whether an identity can no longer authorize backend requests.
 *
 * Firebase Functions reports callable authentication failures as
 * `functions/unauthenticated`; some auth SDK failures expose a 401 status or
 * an `auth/*` code instead.
 */
export const isAuthenticationUnavailableError = (error) => {
  const codes = [error?.code, error?.cause?.code]
    .filter((value) => typeof value === 'string')
    .map((value) => value.toLowerCase());
  const rawStatus =
    error?.status ??
    error?.statusCode ??
    error?.response?.status ??
    error?.cause?.status ??
    error?.cause?.statusCode ??
    error?.cause?.response?.status;
  const status = Number(rawStatus);

  return status === 401 || codes.some((code) => UNAUTHENTICATED_CODES.has(code));
};

export default isAuthenticationUnavailableError;
