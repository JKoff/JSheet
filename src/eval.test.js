const runJFragment = require('./eval');

describe('runJFragment', function () {
  it('can be a small integer', function () {
    expect(runJFragment('1234', () => null)).toBe(1234);
  });
  it('can increment a small integer (VN)', function () {
    expect(runJFragment('>: 1', () => null)).toBe(2);
  });
  it('can increment a small integer twice (VVN)', function () {
    expect(runJFragment('>: >: 1', () => null)).toBe(3);
  });
  it('can add two integers (NVN)', function () {
    expect(runJFragment('1 + 2', () => null)).toBe(3);
  });
  it('can access an externally-provided symbol', function () {
    expect(runJFragment('bound + 2', name => name === 'bound' ? 123 : null)).toBe(125);
  });
  it('does something reasonable when an unknown symbol is encountered', function () {
    expect(() => runJFragment('1 + bear', () => null)).toThrow(Error);
  });
  // it('Project Euler 16 should be correct', function () {
  //   expect(runJFragment('+/ 10 baserep (x: 2) ^ 1000')).toBe(1366);
  // });
});