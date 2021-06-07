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
  },

  dropTestSchemas: async function (sequelize) {
    const schemas = await sequelize.showAllSchemas();
    const schemasPromise = [];
    schemas.forEach(schema => {
      const schemaName = schema.name ? schema.name : schema;
      if (schemaName !== sequelize.config.database) {
        schemasPromise.push(sequelize.dropSchema(schemaName));
      }
    });

    await Promise.all(schemasPromise.map(p => p.catch(e => e)));
  }
}

Support.sequelize = Support.createSequelizeInstance();

module.exports = Support;
