# sequelize-cockroach

This package makes Sequelize compatible with CockroachDB.

[Learn how to build a Node.js app with CockroachDB.](https://www.cockroachlabs.com/docs/build-a-nodejs-app-with-cockroachdb-sequelize.html)

Please file bugs against the [sequelize-cockroachdb project](https://github.com/cockroachdb/sequelize-cockroachdb/issues/new)

## Limitations

CockroachDB does not support `ENUM` types, so using `Sequelize.ENUM`s with
CockroachDB will be backed by `TEXT` fields. This means that there will be no
database-level assurance that the fields are valid (though Sequelize itself
will validate values if `typeValidation` is enabled).
