# sequelize-cockroachdb

[This NPM package](https://www.npmjs.com/package/sequelize-cockroachdb) makes Sequelize compatible with CockroachDB.

[Learn how to build a Node.js app with CockroachDB.](https://www.cockroachlabs.com/docs/stable/build-a-nodejs-app-with-cockroachdb-sequelize.html)

Please file bugs against the [sequelize-cockroachdb project](https://github.com/cockroachdb/sequelize-cockroachdb/issues/new)

## Requirements

This package needs Node.js v12 or later

## Setup and run tests

First make sure you have CockroachDB installed. You can run `cockroach version` to see if is installed or you can [download here](https://www.cockroachlabs.com/docs/stable/install-cockroachdb.html)

Run `cockroach start-single-node --insecure --logtostderr` to start the database. If this returns `ERROR: cockroach server exited with error: unable to lookup hostname` run with `--host localhost` flag.

Run `cockroach sql --insecure` to enter in SQL mode and type `CREATE DATABASE sequelize_test;`

Then install the depedencies with `npm i` and `npm test` to run all tests