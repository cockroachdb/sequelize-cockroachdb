const { Sequelize, QueryTypes } = require('sequelize');

const version_helper = require('./version_helper.js')

//// Log telemetry for Sequelize ORM.
Sequelize.addHook('afterInit', async (connection) => {
    try {
        if (connection.options.dialectOptions) {
            var telemetryDisabled = connection.options.dialectOptions.cockroachdbTelemetryDisabled
            if (telemetryDisabled) {
                return 
            }
        }
 
        // crdb_internal.increment_feature_counter is only available on 21.1 and above.
        if (!version_helper.IsCockroachVersion21_1Plus(connection)) {
            return
        }
        var sequelizeVersion = version_helper.GetSequelizeVersion()
        await connection.query(`SELECT crdb_internal.increment_feature_counter(concat('Sequelize ', :SequelizeVersion))`,  
        { replacements: { SequelizeVersion: sequelizeVersion.version  }, type: QueryTypes.SELECT })

        var adapterVersion = version_helper.GetAdapterVersion()
        await connection.query(`SELECT crdb_internal.increment_feature_counter(concat('sequelize-cockroachdb ', :AdapterVersion))`,  
        { replacements: { AdapterVersion: adapterVersion.version }, type: QueryTypes.SELECT })
    } catch (error) {
        console.info("Could not record telemetry.\n" + error)
    }
});
