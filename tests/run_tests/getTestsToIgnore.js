const fs = require('fs'),
  path = require('path'),
  readline = require('readline');

const ignoredTestsPath = './../.github/workflows/ignore_tests/';

async function getTestNames() {
  const files = fs.readdirSync(ignoredTestsPath);

  return Promise.all(
    files.map(async file => {
      const rl = readline.createInterface({
        input: fs.createReadStream(path.join(ignoredTestsPath, file)),
        crlfDelay: Infinity
      });

      const arr = [];

      for await (const line of rl) {
        arr.push(line);
      }

      return arr;
    })
  ).then(arr => arr.flat().join('|'));
}

module.exports = getTestNames;
