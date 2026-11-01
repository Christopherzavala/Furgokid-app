const DEFAULT_PAGE_SIZE = 400;
const MAX_PAGE_SIZE = 500;

const SAFE_ERROR_CODES = new Set([
  'aborted',
  'deadline-exceeded',
  'failed-precondition',
  'invalid-argument',
  'permission-denied',
  'resource-exhausted',
  'unavailable',
  'unknown',
]);

const NUMERIC_ERROR_CODES = new Map([
  [1, 'cancelled'],
  [2, 'unknown'],
  [3, 'invalid-argument'],
  [4, 'deadline-exceeded'],
  [5, 'not-found'],
  [6, 'already-exists'],
  [7, 'permission-denied'],
  [8, 'resource-exhausted'],
  [9, 'failed-precondition'],
  [10, 'aborted'],
  [11, 'out-of-range'],
  [13, 'internal'],
  [14, 'unavailable'],
  [15, 'data-loss'],
  [16, 'unauthenticated'],
]);

const getSafeErrorCode = (error) => {
  const code = error?.code;
  const normalizedCode = typeof code === 'string' ? code.toLowerCase() : '';
  if (SAFE_ERROR_CODES.has(normalizedCode)) return normalizedCode;
  const numericCode = typeof code === 'number' ? code : Number.parseInt(normalizedCode, 10);
  return NUMERIC_ERROR_CODES.get(numericCode) || 'unknown';
};

const isValidDocumentId = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

const createDriverTrackingCleanup = ({ repository, logger, pageSize = DEFAULT_PAGE_SIZE }) => {
  if (
    !repository ||
    typeof repository.listMatchesByDriver !== 'function' ||
    typeof repository.deleteDriverCurrentTrackingIfAssigned !== 'function' ||
    typeof logger !== 'function'
  ) {
    throw new TypeError(
      'Driver tracking cleanup requires complete repository and logger adapters.'
    );
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new RangeError(`pageSize must be between 1 and ${MAX_PAGE_SIZE}.`);
  }

  return async (driverId) => {
    if (!isValidDocumentId(driverId)) {
      throw new TypeError('A valid driver document ID is required.');
    }

    const result = {
      complete: true,
      scannedCount: 0,
      deletedCount: 0,
      missingCount: 0,
      deniedCount: 0,
      failedCount: 0,
    };
    let pageToken = null;
    let hasMorePages = true;
    const seenTokens = new Set();

    while (hasMorePages) {
      let page;
      try {
        page = await repository.listMatchesByDriver({
          driverId,
          pageToken,
          pageSize,
        });
        if (
          !page ||
          !Array.isArray(page.matches) ||
          !(page.nextPageToken === null || typeof page.nextPageToken === 'string')
        ) {
          throw new TypeError('Repository returned an invalid match page.');
        }
      } catch (error) {
        result.complete = false;
        result.failedCount += 1;
        result.errorCode = getSafeErrorCode(error);
        break;
      }

      for (const candidate of page.matches) {
        result.scannedCount += 1;
        if (!candidate || !isValidDocumentId(candidate.id)) {
          result.complete = false;
          result.failedCount += 1;
          continue;
        }
        try {
          const deletion = await repository.deleteDriverCurrentTrackingIfAssigned(
            candidate.id,
            driverId
          );
          if (deletion === 'deleted') result.deletedCount += 1;
          else if (deletion === 'missing') result.missingCount += 1;
          else if (deletion === 'denied') result.deniedCount += 1;
          else if (deletion === 'match-missing') result.scannedCount -= 1;
          else {
            result.complete = false;
            result.failedCount += 1;
          }
        } catch {
          result.complete = false;
          result.failedCount += 1;
        }
      }

      if (page.nextPageToken === null) {
        hasMorePages = false;
      } else if (seenTokens.has(page.nextPageToken)) {
        result.complete = false;
        result.failedCount += 1;
        hasMorePages = false;
      } else {
        seenTokens.add(page.nextPageToken);
        pageToken = page.nextPageToken;
      }
    }

    logger({
      operation: 'cleanup_driver_tracking',
      result: result.complete ? 'complete' : 'partial',
      scannedCount: result.scannedCount,
      deletedCount: result.deletedCount,
      missingCount: result.missingCount,
      deniedCount: result.deniedCount,
      failedCount: result.failedCount,
      ...(result.errorCode ? { errorCode: result.errorCode } : {}),
    });
    return result;
  };
};

module.exports = {
  createDriverTrackingCleanup,
};
