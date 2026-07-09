// Generic wrapper used by every external API integration (football-data.org
// now, others later). Centralizing this means caching, rate-limit handling,
// and error translation only need to be written once.

const axios = require('axios');
const NodeCache = require('node-cache');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorMiddleware');

// stdTTL in seconds. Football fixtures/standings don't change second-to-second,
// so a 5-minute cache dramatically cuts calls against a 10-req/min free tier.
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Separate, non-expiring cache: every successful response is also mirrored
// here so that if we get rate-limited AFTER the fresh cache has expired,
// we can still serve something instead of a hard failure.
const staleCache = new NodeCache({ stdTTL: 0 });

/**
 * Fetches `url` with caching + graceful failure handling.
 * @param {string} cacheKey - unique key for this request (e.g. 'fd:matches:PL')
 * @param {Function} requestFn - () => Promise<AxiosResponse> — the actual axios call
 * @param {number} [ttlSeconds] - override the default cache TTL for this key
 */
const cachedRequest = async (cacheKey, requestFn, ttlSeconds) => {
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.debug(`Cache hit: ${cacheKey}`);
    return { data: cached, fromCache: true };
  }

  try {
    const response = await requestFn();
    cache.set(cacheKey, response.data, ttlSeconds);
    staleCache.set(cacheKey, response.data);
    return { data: response.data, fromCache: false };
  } catch (err) {
    if (err.response?.status === 429) {
      // Rate limited. Don't retry inline and block the request — that just
      // compounds the problem. Serve stale data if we have any, else fail clearly.
      logger.warn(`Rate limited on ${cacheKey}. Retry-After: ${err.response.headers['retry-after']}`);
      const stale = staleCache.get(cacheKey);
      if (stale) {
        cache.set(cacheKey, stale, 30); // brief cache so we don't retry the provider every request
        return { data: stale, fromCache: true, stale: true };
      }
      throw new AppError('External data provider is rate-limited right now — try again shortly', 503);
    }

    if (err.response) {
      // Provider responded but with an error status (401, 403, 404, etc.)
      logger.error(`External API error on ${cacheKey}: ${err.response.status} ${JSON.stringify(err.response.data)}`);
      throw new AppError(`External data provider returned an error (${err.response.status})`, 502);
    }

    // Network-level failure (DNS, timeout, connection refused, ...)
    logger.error(`External API unreachable for ${cacheKey}: ${err.message}`);
    throw new AppError('External data provider is unreachable', 502);
  }
};

const clearCache = (prefix) => {
  if (!prefix) {
    cache.flushAll();
    staleCache.flushAll();
    return;
  }
  [cache, staleCache].forEach((c) => {
    c.keys().forEach((k) => {
      if (k.startsWith(prefix)) c.del(k);
    });
  });
};

module.exports = { axios, cachedRequest, clearCache, cache };
