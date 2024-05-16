const runJFragment = require('./eval');

describe('runJFragment', function () {
  it('can be a small integer', function () {
    expect(runJFragment('1234')).toBe(1234);
  });
  it('can increment a small integer', function () {
    expect(runJFragment('>: 1')).toBe(2);
  });
  // it('Project Euler 16 should be correct', function () {
  //   expect(runJFragment('+/ 10 baserep (x: 2) ^ 1000')).toBe(1366);
  // });
});