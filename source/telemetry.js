const { Sequelize, QueryTypes } = require('sequelize');

const version_helper = require('./version_helper.js')

//// Log telemetry for Sequelize ORM.
Sequelize.addHook('afterInit', async (connection) => {
    try {
        var telemetryDisabled = connection.options.dialectOptions.cockroachdbTelemetryDisabled
        if (telemetryDisabled) {
            return 
        }
        const versionRow = await connection.query("SELECT version() AS version", { type: QueryTypes.SELECT });
        version = versionRow[0]["version"]

        // This regex pattern should match any version 21.1 and greater.
        // Also assumes that the naming scheme will always follow v[XX].[Y].[ZZZZ]
        // Where XX is the last two digits of the year, Y is the subrelease (currently is always 1/2) and
        // ZZZZ is the point release version.
        // This has to be updated if the version format changes or a new version of CockroachDB is released in the year 2100.
        var re = new RegExp('v([2-9][1-9]|[3-9][0-9]).[1-2].[0-9]*')
        if (!version.match(re)) {
            return
        }
        var sequelizeVersion = version_helper.GetSequelizeVersion()
        console.log(sequelizeVersion.version)
        await connection.query(`SELECT crdb_internal.increment_feature_counter('Sequelize ${sequelizeVersion.version}')`, { type: QueryTypes.SELECT });
    } catch (error) {
        console.warn("Could not record telemetry.")
        console.warn(error)
    }
});
