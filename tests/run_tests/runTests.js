// This runner instance is meant to be used by CI.
// Paths shown here are aligned to match that implementation.

const Mocha = require('mocha'),
  getTestsToIgnore = require('./getTestsToIgnore');

async function makeMocha() {
  const testsToIgnore = await getTestsToIgnore();

  const mocha = new Mocha({
    grep: testsToIgnore,
    checkLeaks: true,
    reporter: 'spec',
    timeout: 30000,
    invert: true
  });

  const patchPath = './.cockroachdb-patches/index.js';
  const testPath = `./../.downloaded-sequelize/test/integration/${process.env.TEST_PATH}.test.js`;

  mocha.addFile(patchPath);
  mocha.addFile(testPath);

  return mocha;
}

// Run the tests.
makeMocha().then(mocha =>
  mocha.run(function (failures) {
    process.exit(failures ? 1 : 0); // exit with non-zero status if there were failures
  })
);
