const DOG_ID_PATTERN = /^[a-z0-9_-]+$/iu;
const MAX_DOG_ID_LENGTH = 64;

export function isDogId(value: string): boolean {
  return value.length > 0 && value.length <= MAX_DOG_ID_LENGTH && DOG_ID_PATTERN.test(value);
}
