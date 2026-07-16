export const MAX_HTTP_HEADER_VALUE_LENGTH = 8 * 1024;

const HTTP_HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const UNSAFE_HTTP_HEADER_VALUE = /[\u0000-\u001f\u007f]|[^\u0020-\u00ff]/;

export function isSafeHttpHeaderName(name: string) {
  return name.length > 0 && name.length <= 128 && HTTP_HEADER_NAME.test(name);
}

export function isSafeHttpHeaderValue(value: string) {
  return (
    value.length <= MAX_HTTP_HEADER_VALUE_LENGTH &&
    !UNSAFE_HTTP_HEADER_VALUE.test(value)
  );
}

export function setSafeHttpHeader(
  headers: Headers,
  name: string,
  value: string,
) {
  if (!isSafeHttpHeaderName(name) || !isSafeHttpHeaderValue(value)) return false;
  headers.set(name, value);
  return true;
}
