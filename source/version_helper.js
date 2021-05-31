const semver = require('semver');
const { version, release } = require('sequelize/package.json');

module.exports = {
  GetSequelizeVersion: function() {
      // In v4 and v5 package.json files, have a property 'release: { branch: 'v5' }'
      // but in v6 it has 'release: { branches: ['v6'] }'
      var branchVersion = release.branches ? release.branches[0] : release.branch;
      // When executing the tests on Github Actions the version it gets from sequelize is from the repository which has a development version '0.0.0-development'
      // in that case we fallback to a branch version
      return semver.coerce(version === '0.0.0-development' ? branchVersion : version);
  },
};

