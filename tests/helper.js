// Copyright 2021 The Cockroach Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
// implied. See the License for the specific language governing
// permissions and limitations under the License.

const chai = require('chai');
const Sequelize = require('../source');

chai.use(require('chai-as-promised'));
chai.use(require('chai-datetime'));
chai.use(require('sinon-chai'));

// These tests run against a local instance of CockroachDB that meets the
// following requirements:
//
// 1. Running with the --insecure flag.
// 2. Contains a database named "sequelize_test".

// To override the CockroachDB port, set the COCKROACH_PORT environment
// variable.

async function cleanupDatabase(sequelize) {
  // https://github.com/sequelize/sequelize/blob/29901187d9560e7d51ae1f9b5f411cf0c5d8994a/test/support.js#L136
  const qi = sequelize.getQueryInterface();
  await qi.dropAllTables();
  sequelize.modelManager.models = [];
  sequelize.models = {};
  if (qi.dropAllEnums) {
    await qi.dropAllEnums();
  }
  const schemas = await sequelize.showAllSchemas();
  for (const schema of schemas) {
    const schemaName = schema.name || schema;
    if (schemaName !== sequelize.config.database) {
      await sequelize.dropSchema(schemaName);
    }
  }
}

before(function () {
  this.sequelize = makeTestSequelizeInstance();
});

afterEach(async function () {
  await cleanupDatabase(this.sequelize);
});

after(async function () {
  await this.sequelize.close();
});

function makeTestSequelizeInstance() {
  return new Sequelize('sequelize_test', 'root', '', {
    dialect: 'postgres',
    port: process.env.COCKROACH_PORT || 26257,
    logging: false,
    typeValidation: true,
    dialectOptions: {cockroachdbTelemetryDisabled : true},
  });
}

module.exports = { makeTestSequelizeInstance };
