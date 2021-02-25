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
const sequelizeVersion = require('sequelize/package.json').version;
if (semver.satisfies(sequelizeVersion, '<=4')) {
  throw new Error(`Sequelize versions 4 and below are not supported by sequelize-cockroachdb. Detected version is ${sequelizeVersion}.`);
}

//// [1] Override the `upsert` query method from Sequelize v5 to make it work with CockroachDB

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

// [4] Fix int to string conversion
const { ConnectionManager } = require('sequelize/lib/dialects/abstract/connection-manager');
ConnectionManager.prototype.__loadDialectModule = ConnectionManager.prototype._loadDialectModule;
ConnectionManager.prototype._loadDialectModule = function (...args) {
  const pg = this.__loadDialectModule(...args);
  pg.types.setTypeParser(20, function (val) {
    if (val > Number.MAX_SAFE_INTEGER) return BigInt(val);
    else return parseInt(val, 10);
  });
  return pg;
}

// [5] Patch drop constraint query
// [6] Drop all tables except the crdb_internal
if(semver.satisfies(sequelizeVersion, '5.x')) {
  const { QueryInterface } = require('sequelize/lib/query-interface');
  QueryInterface.prototype.__dropSchema = QueryInterface.prototype.dropSchema;
  
  QueryInterface.prototype.dropSchema = async function (tableName, options) {
    if(tableName === 'crdb_internal') return;
    
    await this.__dropSchema(tableName, options);
  };
} else {
  const { PostgresQueryInterface } = require('sequelize/lib/dialects/postgres/query-interface');
  
  PostgresQueryInterface.prototype.__dropSchema = PostgresQueryInterface.prototype.dropSchema;
  
  PostgresQueryInterface.prototype.dropSchema = async function (tableName, options) {
    if(tableName === 'crdb_internal') return;
    
    await this.__dropSchema(tableName, options);
  };
}

// [7] Patch drop constraint query
const QueryGenerator = require('sequelize/lib/dialects/postgres/query-generator');

QueryGenerator.prototype.__removeConstraintQuery = QueryGenerator.prototype.removeConstraintQuery;
QueryGenerator.prototype.removeConstraintQuery = function (...args) {
  const query = this.__removeConstraintQuery(...args)
  const [, constraintName] = query.split('DROP CONSTRAINT')

  return `DROP INDEX ${constraintName} CASCADE;`
}

// [6] Patch unknown constraint error, undefined table
// const { Query } = require('sequelize/lib/dialects/postgres/query');
// Query.prototype.__formatError = Query.prototype.formatError;

// Query.prototype.formatError = function (err) {
//   const [,tableName] = err.sql.match(/alter table "(.+?)"/i);
//   err.message = err.message + ` in relation "${tableName}"`
//   this.__formatError(err)
//
const { PostgresQueryInterface } = require('sequelize/lib/dialects/postgres/query-interface');
  
PostgresQueryInterface.prototype.__removeConstraint = PostgresQueryInterface.prototype.removeConstraint;

PostgresQueryInterface.prototype.removeConstraint = async function (tableName, constraintName, options) {
  try {
    await this.__removeConstraint(tableName, constraintName, options);
  } catch(error) {
    if(error.message.includes('use DROP INDEX CASCADE instead')) {
      const query = this.queryGenerator.removeConstraintQuery(tableName, constraintName);
      const [, queryConstraintName] = query.split('DROP CONSTRAINT');
      const newQuery = `DROP INDEX ${queryConstraintName} CASCADE;`;

      return this.sequelize.query(newQuery, options);
    }
    else 
      throw error;
  }
};

//// Done!

Sequelize.supportsCockroachDB = true;
module.exports = require('sequelize');