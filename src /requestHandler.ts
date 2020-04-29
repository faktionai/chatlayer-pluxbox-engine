import request, { SuperAgentRequest } from 'superagent';
import crypto from 'crypto';

const METHODS: METHODS[] = ['get', 'post', 'put', 'del', 'patch'];
export type METHODS = 'get' | 'post' | 'put' | 'del' | 'patch';

interface HMACOptions {
  key: string;
  header: string;
  secret: string;
  encoding?: string;
}

export interface RequestHandlerOptions {
  url: string;
  headers?: object;
  query?: object;
  auth?: { user: string; password: string };
  SSL?: { key: string; cert: string };
  timeout?: Parameters<SuperAgentRequest['timeout']>[0];
  HMAC?: HMACOptions;
  retry?: number;
}

export type RequestHandler = { [index in METHODS]: <T = any>(route: string, options: RequestOptions) => Promise<T> };

export interface RequestOptions {
  headers?: object;
  query?: object;
  body?: object;
  timeout?: Parameters<SuperAgentRequest['timeout']>[0];
}

const BASIC_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

const makeHMACHeaders = ({ key, secret, encoding = 'sha256' }: HMACOptions, body: RequestOptions['body']): object => {
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomBytes(24).toString('hex');
  const data = JSON.stringify(body);
  const authData = [data, timestamp, nonce, key].join('\n');
  const authHash = crypto
    .createHash(encoding)
    .update(authData)
    .digest('hex');
  const hash = crypto
    .createHmac(encoding, secret)
    .update(authHash)
    .digest('base64');
  return {
    hash,
    nonce,
    timestamp,
    charset: 'utf8',
    'Content-Length': data.length,
  };
};

// simplify request error for easy logging
export const sanitizeRequestError = (error: any) => {
  let requestURL;
  let responseText;
  let statusText;
  if (error.response) {
    requestURL = error.response.request && `${error.response.request.method} ${error.response.request.url}`;
    if (error.response.res && error.response.header['content-type'] === 'application/json') {
      responseText = error.response.res.text;
      statusText = error.response.res.statusMessage;
    }
  }
  delete error.response;
  delete error.request;
  error.request = requestURL;
  error.response = responseText;
  error.statusText = statusText;
  return error;
};

export const requestHandler = async <T>(
  method: METHODS,
  {
    url = '',
    headers = {},
    query = {},
    body = {},
    auth,
    SSL,
    HMAC,
    timeout,
    retry,
  }: RequestHandlerOptions & RequestOptions
): Promise<T> => {
  const handler: SuperAgentRequest = request[method](url)
    .set({ ...BASIC_HEADERS, ...headers })
    .query(query);
  if (auth) handler.auth(auth.user, auth.password);
  if (SSL) handler.cert(SSL.cert).key(SSL.key);
  if (HMAC) handler.set(makeHMACHeaders(HMAC, body));
  if (timeout) handler.timeout(timeout);
  if (retry) handler.retry(retry);
  const { body: result } = await handler.send(method !== 'get' ? body : undefined);
  return result;
};

export const createRequestHandler = ({
  url = '',
  headers: defaultHeaders = {},
  query: defaultQuery = {},
  ...options
}: RequestHandlerOptions): RequestHandler => {
  return METHODS.reduce(
    (handler: RequestHandler, method: string): RequestHandler => ({
      ...handler,
      [method]: async <T>(route: string, { body = {}, query = {}, headers = {}, timeout }: RequestOptions = {}) => {
        return requestHandler<T>(method as METHODS, {
          body,
          timeout,
          ...options,
          url: `${url}${route}`,
          query: { ...defaultQuery, ...query },
          headers: { ...defaultHeaders, ...headers },
        });
      },
    }),
    {} as any
  );
};

export default createRequestHandler;
