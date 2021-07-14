# Version 6.0.0
Released June 14, 2021
* Initial support for Sequelize 6.0
* Added telemetry. The sequelize version is recorded when creating a new instance of a CockroachDB Sequelize instance.
* Opt out of telemetry by specifying `cockroachdbTelemetryDisabled : true` in the `dialectOptions` object when creating a `Sequelize` object.
* Example:
    ```
    var sequelize2 = new Sequelize({
        dialect: "postgres",
        username: "max",
        password: "",
        host: "localhost",
        port: 26257,
        database: "sequelize_test",
        dialectOptions: {cockroachdbTelemetryDisabled : true},
        logging: false,
    });
    ```

# Version 6.0.1
Released July 14, 2021
* Record telemetry for sequelize-cockroachdb version in addition to the sequelize version.