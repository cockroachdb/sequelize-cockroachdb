const { Sequelize, QueryTypes } = require('sequelize');

const version_helper = require('./version_helper.js')

//// Log telemetry for Sequelize ORM.
Sequelize.addHook('afterInit', async (connection) => {
    try {
        var telemetryDisabled = connection.options.dialectOptions.cockroachdbTelemetryDisabled
        if (telemetryDisabled) {
            return 
        }
 
<<<<<<< HEAD
        if (!version_helper.IsCockroachVersion21_1Plus(connection)) {
=======
        if (!IsCockroachVersion21_1Plus(connection)) {
>>>>>>> cb33215 (Only run geometry test on versions >= 21.2)
            return
        }
        var sequelizeVersion = version_helper.GetSequelizeVersion()
        await connection.query(`SELECT crdb_internal.increment_feature_counter('Sequelize ${sequelizeVersion.version}')`, { type: QueryTypes.SELECT });
    } catch (error) {
        console.info("Could not record telemetry.\n" + error)
    }
});
