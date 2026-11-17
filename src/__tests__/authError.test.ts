import { isAuthenticationUnavailableError } from '../utils/authError';

describe('isAuthenticationUnavailableError', () => {
  it.each([
    ['status', { status: 401 }],
    ['statusCode', { statusCode: 401 }],
    ['response.status', { response: { status: 401 } }],
    ['cause.status', { cause: { status: 401 } }],
    ['cause.response.status', { cause: { response: { status: 401 } } }],
  ])('recognises a 401 from %s', (_source, error) => {
    expect(isAuthenticationUnavailableError(error)).toBe(true);
  });

  it.each([
    'unauthenticated',
    'functions/unauthenticated',
    'auth/user-token-expired',
    'auth/user-disabled',
    'auth/user-not-found',
  ])('recognises the %s authentication code', (code) => {
    expect(isAuthenticationUnavailableError({ code })).toBe(true);
  });

  it('recognises an authentication code nested in cause', () => {
    expect(
      isAuthenticationUnavailableError({
        cause: { code: 'functions/unauthenticated' },
      })
    ).toBe(true);
  });

  it('does not classify unrelated failures as authentication errors', () => {
    expect(
      isAuthenticationUnavailableError({
        code: 'functions/internal',
        status: 500,
      })
    ).toBe(false);
    expect(isAuthenticationUnavailableError(undefined)).toBe(false);
  });
});
