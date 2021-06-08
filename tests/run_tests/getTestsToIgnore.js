const fs = require('fs'),
  path = require('path'),
  readline = require('readline');
const version_helper = require ('../../source/version_helper.js')
const semver = require('semver');

const sharedIgnoredTestsPath = './../.github/workflows/ignore_tests/shared';

async function parseFilesForTests(files) {
  return files.map(async file => {
    const rl = readline.createInterface({
      input: fs.createReadStream(path.join(sharedIgnoredTestsPath, file)),
      crlfDelay: Infinity
    });

    const arr = [];

    for await (const line of rl) {
      arr.push(line);
    }

    return arr;
  })
}

async function getTestNames() {
  var files = fs.readdirSync(sharedIgnoredTestsPath);

  if (semver.satisfies(sequelizeVersion, '<=5')) {
    if (version_helper.GetSequelizeVersion() == 'v5') {
      const v5IgnoredTestsPath = './../.github/workflows/ignore_tests/shared/v5';
      var v5files = await fs.readdirSync(v5IgnoredTestsPath)
      files = files.concat(v5files);
    }
  }

  return Promise.resolve(parseFilesForTests(files).then(
    arr => Promise.all(arr).then(arr => arr.flat().join('|')))
  );
}

module.exports = getTestNames;
