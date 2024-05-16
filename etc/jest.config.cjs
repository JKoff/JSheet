module.exports = {
    transformIgnorePatterns: ['.*/node_modules/.*'],
    testEnvironment: 'node',
    testMatch: ['**/*.test.js'],
    testPathIgnorePatterns: ['/node_modules/'],
    rootDir: '../src',
};