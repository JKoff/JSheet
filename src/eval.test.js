const { runJFragment, JArray } = require('./eval');

describe('runJFragment', function () {
  it('can be a small integer', function () {
    expect(runJFragment('1234', () => null)).toMatchObject({ data: [1234] });
  });
  it('can increment a small integer (VN)', function () {
    expect(runJFragment('>: 1', () => null)).toMatchObject({ data: [2] });
  });
  it('can increment a small integer twice (VVN)', function () {
    expect(runJFragment('>: >: 1', () => null)).toMatchObject({ data: [3] });
  });
  it('can add two integers (NVN)', function () {
    expect(runJFragment('1 + 2', () => null)).toMatchObject({ data: [3] });
  });
  it('can access an externally-provided symbol', function () {
    expect(runJFragment('bound + 2', name => name === 'bound' ? 123 : null)).toMatchObject({ data: [125] });
  });
  it('does something reasonable when an unknown symbol is encountered', function () {
    expect(() => runJFragment('1 + bear', () => null)).toThrow(Error);
  });
  it('can generate a sequence of integers', function () {
    expect(runJFragment('i. 3', () => null)).toMatchObject({ shape: [3], data: [0, 1, 2] });
  });
  it('can increment a sequence of integers', function () {
    expect(runJFragment('>: i. 3', () => null)).toMatchObject({ shape: [3], data: [1, 2, 3] });
  });
  it('can increment a sequence of integers with a dyad', function () {
    expect(runJFragment('1 + i. 3', () => null)).toMatchObject({ shape: [3], data: [1, 2, 3] });
  });
  // it('can sum two lists of integers', function () {
  //   expect(runJFragment('0 1 2 + 00 10 20', () => null)).toMatchObject({ shape: [3], data: [0, 11, 22] });
  // });
  // it('Project Euler 16 should be correct', function () {
  //   expect(runJFragment('+/ 10 baserep (x: 2) ^ 1000')).toBe(1366);
  // });
});