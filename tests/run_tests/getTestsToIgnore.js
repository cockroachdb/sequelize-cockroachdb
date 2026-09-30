const fs = require('fs'),
  path = require('path'),
  readline = require('readline');

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

  return Promise.all(parseFilesForTests(files)).then(arr => arr.flat().join('|'))
}

module.exports = getTestNames;
