const { isDeepStrictEqual } = require('util');
const Sequelize = require('../source');

const fs = require('fs');

const Support = {
  createSequelizeInstance: function (options = {}) {
    const dialectOptions = {
      cockroachdbTelemetryDisabled: true,
      ...(options.dialectOptions || {})
    };
    if (process.env.DB_SSL === 'true') {
      dialectOptions.ssl = {
        rejectUnauthorized: false,
        require: true
      };
      if (process.env.CA_CERT_PATH) {
        try {
          dialectOptions.ssl.ca = fs
            .readFileSync(process.env.CA_CERT_PATH)
            .toString();
        } catch (e) {
          console.error('Failed to read CA certificate:', e.message);
        }
      }
    }

    return new Sequelize(
      process.env.DB_NAME || 'sequelize_test',
      process.env.DB_USER || 'root',
      process.env.DB_PASS || '',
      {
        dialect: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 26257,
        logging: options.logging !== undefined ? options.logging : console.log,
        typeValidation: true,
        minifyAliases: options.minifyAliases || false,
        dialectOptions: dialectOptions,
        ...options
      }
    );
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
};

Support.sequelize = Support.createSequelizeInstance();

module.exports = Support;
