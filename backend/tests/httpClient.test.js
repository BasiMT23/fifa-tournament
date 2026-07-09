const { cachedRequest, clearCache } = require('../src/services/httpClient');

describe('cachedRequest', () => {
  beforeEach(() => clearCache());

  test('caches a successful response so a second call skips the network', async () => {
    const requestFn = jest.fn().mockResolvedValue({ data: { hello: 'world' } });

    const first = await cachedRequest('test:key1', requestFn);
    const second = await cachedRequest('test:key1', requestFn);

    expect(first.data).toEqual({ hello: 'world' });
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(requestFn).toHaveBeenCalledTimes(1); // only the first call hit "the network"
  });

  test('different cache keys are independent', async () => {
    const requestFn = jest.fn().mockResolvedValue({ data: { n: 1 } });
    await cachedRequest('test:keyA', requestFn);
    await cachedRequest('test:keyB', requestFn);
    expect(requestFn).toHaveBeenCalledTimes(2);
  });

  test('serves stale data instead of failing when rate-limited (429) after a fresh fetch', async () => {
    const rateLimitError = { response: { status: 429, headers: { 'retry-after': '30' } } };
    const requestFn = jest
      .fn()
      .mockResolvedValueOnce({ data: { score: '1-0' } }) // first call succeeds, populates stale cache
      .mockRejectedValueOnce(rateLimitError); // second call (after TTL expiry) gets rate-limited

    await cachedRequest('test:key2', requestFn, 0.01); // ~10ms TTL so it expires almost immediately
    await new Promise((r) => setTimeout(r, 50));

    const result = await cachedRequest('test:key2', requestFn);
    expect(result.stale).toBe(true);
    expect(result.data).toEqual({ score: '1-0' });
  });

  test('throws a 503 AppError when rate-limited with no stale data available', async () => {
    const rateLimitError = { response: { status: 429, headers: {} } };
    const requestFn = jest.fn().mockRejectedValue(rateLimitError);

    await expect(cachedRequest('test:never-cached', requestFn)).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  test('throws a 502 AppError on a non-429 provider error', async () => {
    const providerError = { response: { status: 404, data: { message: 'not found' } } };
    const requestFn = jest.fn().mockRejectedValue(providerError);

    await expect(cachedRequest('test:404case', requestFn)).rejects.toMatchObject({ statusCode: 502 });
  });

  test('throws a 502 AppError on a network-level failure', async () => {
    const networkError = new Error('ECONNREFUSED');
    const requestFn = jest.fn().mockRejectedValue(networkError);

    await expect(cachedRequest('test:network-fail', requestFn)).rejects.toMatchObject({ statusCode: 502 });
  });
});
