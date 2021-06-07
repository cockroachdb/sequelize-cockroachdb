const semver = require('semver');
const { version, release } = require('sequelize/package.json');
const { QueryTypes } = require('sequelize');

module.exports = {
  GetSequelizeVersion: function() {
      // In v4 and v5 package.json files, have a property 'release: { branch: 'v5' }'
      // but in v6 it has 'release: { branches: ['v6'] }'
      var branchVersion = release.branches ? release.branches[0] : release.branch;
      // When executing the tests on Github Actions the version it gets from sequelize is from the repository which has a development version '0.0.0-development'
      // in that case we fallback to a branch version
      return semver.coerce(version === '0.0.0-development' ? branchVersion : version);
  },
  CockroachVersionGreaterThan21_1: async function(connection) {
    const versionRow = await connection.query("SELECT version() AS version", { type: QueryTypes.SELECT });
    const cockroachDBVersion = versionRow[0]["version"]

    // This regex pattern should match any version 21.1 and greater.
    // Also assumes that the naming scheme will always follow v[XX].[Y].[ZZZZ]
    // Where XX is the last two digits of the year, Y is the subrelease (currently is always 1/2) and
    // ZZZZ is the point release version.
    // This has to be updated if the version format changes or a new version of CockroachDB is released in the year 2100.
    var re = new RegExp('v([2-9][1-9]|[3-9][0-9]).[1-2].[0-9]*')
    return cockroachDBVersion.match(re)
  }
};

