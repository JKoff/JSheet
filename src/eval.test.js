const { runJFragment, JArray } = require('./eval');

const fn = arg => runJFragment(arg, () => null, () => null);

describe('runJFragment', function () {
  it('can be a small integer', function () {
    expect(fn('1234')).toMatchObject({ data: [1234] });
  });
  it('can increment a small integer (VN)', function () {
    expect(fn('>: 1')).toMatchObject({ data: [2] });
  });
  it('can increment a small integer twice (VVN)', function () {
    expect(fn('>: >: 1')).toMatchObject({ data: [3] });
  });
  it('can add two integers (NVN)', function () {
    expect(fn('1 + 2')).toMatchObject({ data: [3] });
  });
  it('can access an externally-provided symbol', function () {
    expect(runJFragment('bound + 2', name => name === 'bound' ? 123 : null, () => null)).toMatchObject({ data: [125] });
  });
  it('does something reasonable when an unknown symbol is encountered', function () {
    expect(() => fn('1 + bear')).toThrow(Error);
  });
  it('can generate a sequence of integers', function () {
    expect(fn('i. 3')).toMatchObject({ shape: [3], data: [0, 1, 2] });
  });
  it('can increment a sequence of integers', function () {
    expect(fn('>: i. 3')).toMatchObject({ shape: [3], data: [1, 2, 3] });
  });
  it('can increment a sequence of integers with a dyad', function () {
    expect(fn('1 + i. 3')).toMatchObject({ shape: [3], data: [1, 2, 3] });
  });
  it('can export a new symbol', function () {
    let calledKey, calledValue;
    const exportFn = (key, value) => { [calledKey, calledValue] = [key, value]; };
    runJFragment('Result =: 5', () => null, exportFn);
    expect(calledKey).toBe('Result');
    expect(calledValue).toMatchObject({ data: [5] });
  });
  it('can construct a sequence by appending', function () {
    expect(fn('1 , 2 , 3')).toMatchObject({ shape: [3], data: [1, 2, 3] });
  });
  it('can reciprocal a number', function () {
    expect(fn('% 10')).toMatchObject({ data: [0.1] });
  });
  it('can divide two numbers', function () {
    expect(fn('10 % 2')).toMatchObject({ data: [5] });
  });
  // it('can sum two lists of integers', function () {
  //   expect(runJFragment('0 1 2 + 00 10 20', () => null)).toMatchObject({ shape: [3], data: [0, 11, 22] });
  // });
  // it('Project Euler 16 should be correct', function () {
  //   expect(runJFragment('+/ 10 baserep (x: 2) ^ 1000')).toBe(1366);
  // });
});