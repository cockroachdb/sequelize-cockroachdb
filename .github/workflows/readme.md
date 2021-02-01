# CI workflow for executing Sequelize's postgres tests targeting CockroachDB

The `ci.yml` file includes a job specification called `sequelize-postgres-integration-tests` which is responsible for running Sequelize's own integration tests that were originally written for postgres but targeting CockroachDB instead.

It works as follows:

* Download the Sequelize source code into a temporary folder called `.downloaded-sequelize`
* Install all Sequelize dependencies (in order to be able to run all Sequelize's own tests)
* Copy `sequelize-cockroachdb` source code into `.downloaded-sequelize/.cockroachdb-patches/`
  * This is done via the `put-our-patches-in-downloaded-sequelize.js` helper file. It not only copies our source code, but also wraps it in a way that patches all our `require('sequelize')` calls to make them work inside Sequelize's source code. The `require` wrapper simply transforms arguments like `'sequelize'` into the appropriate relative path (which is `'..'` since our code is within the `.cockroach-patches` directory).
* Tell Sequelize to execute our code (in `.downloaded-sequelize/.cockroachdb-patches/`) before running the tests
* Run Sequelize tests
  * Note: if a test fails in a way that the database cannot be cleaned up afterwards, this will cause the entire test execution to abort; to minimize the impact of this, the Sequelize tests will be run separately per test file instead of running all tests at once.
