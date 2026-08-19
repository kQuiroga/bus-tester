import { JsonPrettyPipe } from './json-pretty.pipe';

describe('JsonPrettyPipe', () => {
  let pipe: JsonPrettyPipe;

  beforeEach(() => {
    pipe = new JsonPrettyPipe();
  });

  it('valid JSON returns JSON.stringify(JSON.parse(input), null, 2) (T14)', () => {
    const input = '{"id":1,"name":"orders"}';

    expect(pipe.transform(input)).toBe(JSON.stringify(JSON.parse(input), null, 2));
  });

  it('invalid/non-JSON input returns the original string unchanged, no throw (T15)', () => {
    const input = 'not json at all {broken';

    expect(() => pipe.transform(input)).not.toThrow();
    expect(pipe.transform(input)).toBe(input);
  });

  it('empty string input returns unchanged (fallback path) (T16)', () => {
    expect(pipe.transform('')).toBe('');
  });
});
