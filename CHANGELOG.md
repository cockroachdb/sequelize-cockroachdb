# Version 6.0.6
Released September 30, 2026
* Fixed creating ENUM types with recent versions of Sequelize v6.
* Removed telemetry. Creating a Sequelize instance no longer runs any queries, so it no longer logs an error when the database is not reachable. The `cockroachdbTelemetryDisabled` dialect option is still accepted, but has no effect.
* Updated CockroachDB versions under test (v24.3, v25.2, v25.4, and v26.2).
* Sequelize v5 is no longer tested.

# Version 6.0.5
Released January 12, 2022
* Fixed a bug with importing modules from Sequelize.
* Updated CockroachDB versions under test (includes v21.2 now).

# Version 6.0.4
Released December 16, 2021
* Fixed a bug with checking the version on startup.

# Version 6.0.3
Released October 21, 2021
* Use a deterministic ordering when introspecting enum types.
* Version number telemetry now only reports the major/minor versions of Sequelize.

# Version 6.0.2
Released September 30, 2021
* Fix a missing import that would cause an error when validating datatypes.

# Version 6.0.1
Released July 14, 2021
* Record telemetry for sequelize-cockroachdb version in addition to the sequelize version.

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
