// Copyright 2020 The Cockroach Authors.
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

'use strict';

// Ensure the user did not forget to install Sequelize.
try {
  require('sequelize');
} catch (_) {
  throw new Error('Failed to load Sequelize. Have you installed it? Run `npm install sequelize`');
}

const { Sequelize, DataTypes, QueryTypes } = require('sequelize');

// Ensure Sequelize version compatibility.
const semver = require('semver');
const { version, release } = require('sequelize/package.json');
const sequelizeVersion = version === '0.0.0-development' ? release.branches[0] : version;

console.log('VVV: ', sequelizeVersion)
console.log('VVV coerce: ', semver.coerce(sequelizeVersion))
console.log('below v4: ', semver.satisfies(sequelizeVersion, '<=4'))
if (semver.satisfies(sequelizeVersion, '<=4')) {
  throw new Error(`Sequelize versions 4 and below are not supported by sequelize-cockroachdb. Detected version is ${sequelizeVersion}.`);
}

//// [1] Override the `upsert` query method from Sequelize v5 to make it work with CockroachDB

console.log('is v5:: ', semver.satisfies(sequelizeVersion, '5.x'))
if (semver.satisfies(sequelizeVersion, '5.x')) {
  require('./patch-upsert-v5');
}

//// [2] Disable `EXCEPTION` support

// This prevents, for example, usage of CREATE/REPLACE FUNCTION when using Model.findOrCreate()
const PostgresDialect = require('sequelize/lib/dialects/postgres');
PostgresDialect.prototype.supports.EXCEPTION = false;

//// [3] Tell Sequelize to accept large numbers as strings

// The JavaScript number type cannot represent all 64-bit integers--it can only
// exactly represent integers in the range [-2^53 + 1, 2^53 - 1]. Notably,
// CockroachDB's unique_rowid() function returns values outside the
// representable range.
//
// We must teach Sequelize's INTEGER and BIGINT types to accept stringified
// numbers instead of just raw JavaScript numbers; it's otherwise impossible to
// store a number outside the representable range into a CockroachDB INT column.
[DataTypes.postgres.INTEGER, DataTypes.postgres.BIGINT].forEach(function (intType) {
  // Disable escaping so that the returned string is not wrapped in quotes
  // downstream. Valid integers cannot be dangerous, and we take care to reject
  // invalid integers.
  intType.prototype.escape = false;

  intType.prototype.$stringify = intType.prototype._stringify = function stringify(value) {
    var rep = String(value);
    if (!/^[-+]?[0-9]+$/.test(rep)) {
      throw new Sequelize.ValidationError(util.format("%j is not a valid integer", value));
    }
    return rep;
  }
});

//// Done!

Sequelize.supportsCockroachDB = true;
module.exports = require('sequelize');
require('pg').defaults.parseInt8 = true;