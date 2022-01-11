const fs = require('fs'),
  path = require('path'),
  readline = require('readline');
const version_helper = require ('../../source/version_helper.js')
const semver = require('semver');

const sharedIgnoredTestsPath = './../.github/workflows/ignore_tests/shared';

function parseFilesForTests(files) {
  return files.map(async file => {
    const rl = readline.createInterface({
      input: fs.createReadStream(file),
      crlfDelay: Infinity
    });

    const arr = [];

    for await (const line of rl) {
      arr.push(line);
    }

    return arr;
  })
}

function getTestNames() {
  var files = fs.readdirSync(sharedIgnoredTestsPath).map(f => {
    return path.join(sharedIgnoredTestsPath, f);
  });

  const sequelizeVersion = version_helper.GetSequelizeVersion()
  if (semver.satisfies(sequelizeVersion, '<=5')) {
    const v5IgnoredTestsPath = './../.github/workflows/ignore_tests/v5';
    var v5files = fs.readdirSync(v5IgnoredTestsPath)
    files = files.concat(
      v5files.map(f => {
        return path.join(v5IgnoredTestsPath, f);
      })
    );
  }

  return Promise.all(parseFilesForTests(files)).then(arr => arr.flat().join('|'))
}

module.exports = getTestNames;
