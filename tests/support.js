const { isDeepStrictEqual } = require('util');
const Sequelize = require('../source');

const Support = {
  createSequelizeInstance: function (options = {}) {
    return new Sequelize('sequelize_test', 'root', '', {
      dialect: 'postgres',
      port: process.env.COCKROACH_PORT || 26257,
      logging: console.log,
      typeValidation: true,
      minifyAliases: options.minifyAliases || false,
      ...options
    });
  },

  isDeepEqualToOneOf: function (actual, expectedOptions) {
    return expectedOptions.some(expected =>
      isDeepStrictEqual(actual, expected)
    );
  },

  getPoolMax: function () {
    // sequelize.config.pool.max default is 5.
    return 5;
  }
}

Support.sequelize = Support.createSequelizeInstance();

module.exports = Support;
