const DEFAULT_PAGE_SIZE = 400;
const MAX_PAGE_SIZE = 500;
const AUTHORIZED_OWNER_FIELDS = new Set(['driverId', 'parentId']);
const GRPC_ERROR_CODES = new Map([
  ['4', 'deadline-exceeded'],
  ['8', 'resource-exhausted'],
  ['10', 'aborted'],
  ['13', 'internal'],
  ['14', 'unavailable'],
]);
const RETRYABLE_ERROR_CODES = new Set([
  'aborted',
  'deadline-exceeded',
  'internal',
  'resource-exhausted',
  'unavailable',
]);

const isValidDocumentId = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

const getErrorCode = (error) => {
  const rawCode = error?.code;
  const code = typeof rawCode === 'number' ? String(rawCode) : rawCode;
  if (typeof code !== 'string') return 'unknown';

  const normalizedCode = code.toLowerCase();
  if (GRPC_ERROR_CODES.has(normalizedCode)) {
    return GRPC_ERROR_CODES.get(normalizedCode);
  }
  return /^[a-z0-9-]{1,64}$/.test(normalizedCode) ? normalizedCode : 'unknown';
};

const isRetryableError = (errorCode) => RETRYABLE_ERROR_CODES.has(errorCode);

const assertDependencies = ({ repository, authorizer, logger }) => {
  const repositoryMethods = [
    'deleteMatchCurrentTracking',
    'listActiveMatchesByDriver',
    'deleteDriverCurrentTrackingIfActiveMatch',
  ];

  if (!repository || repositoryMethods.some((method) => typeof repository[method] !== 'function')) {
    throw new TypeError('GPS cleanup requires a complete repository adapter.');
  }
  if (
    !authorizer ||
    typeof authorizer.authorizeMatchCleanup !== 'function' ||
    typeof authorizer.getAuthorizedDriverId !== 'function'
  ) {
    throw new TypeError('GPS cleanup requires an authorization adapter.');
  }
  if (typeof logger !== 'function') {
    throw new TypeError('GPS cleanup requires an injected logger.');
  }
};

const logResult = (logger, operation, result, startedAt, now) => {
  logger({
    operation,
    result: result.status || (result.complete ? 'complete' : 'partial'),
    deletedCount: result.deletedCount || 0,
    missingCount: result.missingCount || 0,
    matchMissingCount: result.matchMissingCount || 0,
    skippedCount: result.skippedCount || 0,
    failedCount: result.failedCount || 0,
    retryableCount: result.retryableCount || 0,
    permanentFailureCount: result.permanentFailureCount || 0,
    durationMs: Math.max(0, now() - startedAt),
    ...(result.errorCode ? { errorCode: result.errorCode } : {}),
  });
};

const createGpsCleanup = ({
  repository,
  authorizer,
  logger,
  now = Date.now,
  pageSize = DEFAULT_PAGE_SIZE,
}) => {
  assertDependencies({ repository, authorizer, logger });
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new RangeError(`GPS cleanup pageSize must be between 1 and ${MAX_PAGE_SIZE}.`);
  }

  const cleanupMatchCurrentTracking = async (matchId) => {
    if (!isValidDocumentId(matchId)) {
      throw new TypeError('A valid match document ID is required.');
    }

    const startedAt = now();
    let result;
    try {
      const authorization = await authorizer.authorizeMatchCleanup(matchId);
      const owner = authorization?.owner;
      if (
        authorization?.authorized !== true ||
        authorization.matchId !== matchId ||
        !owner ||
        !AUTHORIZED_OWNER_FIELDS.has(owner.field) ||
        !isValidDocumentId(owner.uid)
      ) {
        result = { status: 'denied', deletedCount: 0, missingCount: 0, failedCount: 0 };
      } else {
        const deletion = await repository.deleteMatchCurrentTracking(matchId, owner);
        if (deletion === 'deleted') {
          result = { status: 'deleted', deletedCount: 1, missingCount: 0, failedCount: 0 };
        } else if (deletion === 'missing') {
          result = { status: 'missing', deletedCount: 0, missingCount: 1, failedCount: 0 };
        } else if (deletion === 'match-missing') {
          result = { status: 'match-missing', deletedCount: 0, missingCount: 0, failedCount: 0 };
        } else if (deletion === 'denied') {
          result = { status: 'denied', deletedCount: 0, missingCount: 0, failedCount: 0 };
        } else if (deletion === 'skipped') {
          result = {
            status: 'skipped',
            deletedCount: 0,
            missingCount: 0,
            skippedCount: 1,
            failedCount: 0,
          };
        } else {
          throw new TypeError('Repository returned an invalid cleanup result.');
        }
      }
    } catch (error) {
      const errorCode = getErrorCode(error);
      result = {
        status: 'failed',
        deletedCount: 0,
        missingCount: 0,
        matchMissingCount: 0,
        failedCount: 1,
        retryableCount: Number(isRetryableError(errorCode)),
        permanentFailureCount: Number(!isRetryableError(errorCode)),
        errorCode,
      };
    }

    logResult(logger, 'cleanup_match_current_tracking', result, startedAt, now);
    return result;
  };

  const cleanupDriverActiveMatchTracking = async () => {
    const startedAt = now();
    const result = {
      complete: true,
      scannedCount: 0,
      deletedCount: 0,
      missingCount: 0,
      matchMissingCount: 0,
      skippedCount: 0,
      failedCount: 0,
      retryableCount: 0,
      permanentFailureCount: 0,
    };

    let driverId;
    try {
      driverId = await authorizer.getAuthorizedDriverId();
    } catch (error) {
      const errorCode = getErrorCode(error);
      result.complete = false;
      result.failedCount++;
      result.retryableCount += Number(isRetryableError(errorCode));
      result.permanentFailureCount += Number(!isRetryableError(errorCode));
      logResult(
        logger,
        'cleanup_driver_active_match_tracking',
        {
          ...result,
          status: 'failed',
          errorCode,
        },
        startedAt,
        now
      );
      return result;
    }

    if (!isValidDocumentId(driverId)) {
      result.complete = false;
      result.failedCount++;
      result.permanentFailureCount++;
      logResult(
        logger,
        'cleanup_driver_active_match_tracking',
        {
          ...result,
          status: 'denied',
          errorCode: 'unauthorized',
        },
        startedAt,
        now
      );
      return result;
    }

    let pageToken = null;
    const seenTokens = new Set();
    let hasMorePages = true;
    while (hasMorePages) {
      let page;
      try {
        page = await repository.listActiveMatchesByDriver({
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
        const errorCode = getErrorCode(error);
        result.complete = false;
        result.failedCount++;
        result.retryableCount += Number(isRetryableError(errorCode));
        result.permanentFailureCount += Number(!isRetryableError(errorCode));
        result.errorCode = errorCode;
        break;
      }

      for (const candidate of page.matches) {
        result.scannedCount++;
        if (!candidate || !isValidDocumentId(candidate.id)) {
          result.complete = false;
          result.failedCount++;
          result.permanentFailureCount++;
          continue;
        }

        try {
          const deletion = await repository.deleteDriverCurrentTrackingIfActiveMatch(
            candidate.id,
            driverId
          );
          if (deletion === 'deleted') {
            result.deletedCount++;
          } else if (deletion === 'missing') {
            result.missingCount++;
          } else if (deletion === 'match-missing') {
            result.matchMissingCount++;
          } else if (deletion === 'skipped') {
            result.skippedCount++;
          } else {
            throw new TypeError('Repository returned an invalid cleanup result.');
          }
        } catch (error) {
          const errorCode = getErrorCode(error);
          result.complete = false;
          result.failedCount++;
          result.retryableCount += Number(isRetryableError(errorCode));
          result.permanentFailureCount += Number(!isRetryableError(errorCode));
          result.errorCode = errorCode;
        }
      }

      if (page.nextPageToken === null) {
        hasMorePages = false;
        continue;
      }
      if (page.nextPageToken === pageToken || seenTokens.has(page.nextPageToken)) {
        result.complete = false;
        result.failedCount++;
        result.permanentFailureCount++;
        result.errorCode = 'invalid-page-token';
        break;
      }
      seenTokens.add(page.nextPageToken);
      pageToken = page.nextPageToken;
    }

    logResult(logger, 'cleanup_driver_active_match_tracking', result, startedAt, now);
    return result;
  };

  return {
    cleanupMatchCurrentTracking,
    cleanupDriverActiveMatchTracking,
  };
};

// Authorizers must derive identity and cleanup scope from trusted backend context.
// The repository must page by driverId/status and atomically recheck ownership and
// status before deleting a driver's current point; direct cleanup is scoped to
// a verified owner field and UID for one exact match.
module.exports = {
  createGpsCleanup,
};
