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
  throw new Error(
    'Failed to load Sequelize. Have you installed it? Run `npm install sequelize`'
  );
}

const { Sequelize, DataTypes, Model } = require('sequelize');
const QueryGenerator = require('sequelize/lib/dialects/postgres/query-generator');

// Ensure Sequelize version compatibility.
const version_helper = require ('./version_helper.js')
const semver = require('semver');

const sequelizeVersion = version_helper.GetSequelizeVersion()

if (semver.satisfies(sequelizeVersion, '<=4')) {
  throw new Error(
    `Sequelize versions 4 and below are not supported by sequelize-cockroachdb. Detected version is ${sequelizeVersion}.`
  );
}

require('./telemetry.js')

//// [1] Override the `upsert` query method from Sequelize v5 to make it work with CockroachDB
if (semver.satisfies(sequelizeVersion, '5.x')) {
  require('./patch-upsert-v5');
  require('./patches-v5');
} else {
  require('./patches-v6');
}

//// [2] Disable `EXCEPTION` support

const PostgresDialect = require('sequelize/lib/dialects/postgres');
// This prevents, for example, usage of CREATE/REPLACE FUNCTION when using Model.findOrCreate()
PostgresDialect.prototype.supports.EXCEPTION = false;

//// [2.1] Disable lock features support
// lockOuterJoinFailure is not supported.
PostgresDialect.prototype.supports.lockOuterJoinFailure = false;
// skipLocked is not supported.
PostgresDialect.prototype.supports.skipLocked = false;
// lockKey is not supported.
PostgresDialect.prototype.supports.lockKey = false;

//// [3] Tell Sequelize to accept large numbers as strings

// The JavaScript number type cannot represent all 64-bit integers--it can only
// exactly represent integers in the range [-2^53 + 1, 2^53 - 1]. Notably,
// CockroachDB's unique_rowid() function returns values outside the
// representable range.
//
// We must teach Sequelize's INTEGER and BIGINT types to accept stringified
// numbers instead of just raw JavaScript numbers; it's otherwise impossible to
// store a number outside the representable range into a CockroachDB INT column.
[DataTypes.postgres.INTEGER, DataTypes.postgres.BIGINT].forEach(function (
  intType
) {
  // Disable escaping so that the returned string is not wrapped in quotes
  // downstream. Valid integers cannot be dangerous, and we take care to reject
  // invalid integers.
  intType.prototype.escape = false;

  intType.prototype.$stringify = intType.prototype._stringify = function stringify(
    value
  ) {
    var rep = String(value);
    if (!/^[-+]?[0-9]+$/.test(rep)) {
      throw new Sequelize.ValidationError(
        util.format('%j is not a valid integer', value)
      );
    }
    return rep;
  };
});

// [4] Fix int to string conversion
// As pg-types says, "By default the PostgreSQL backend server returns everything as strings."
// Corrects this issue: https://github.com/cockroachdb/sequelize-cockroachdb/issues/50
const {
  ConnectionManager
} = require('sequelize/lib/dialects/abstract/connection-manager');
ConnectionManager.prototype.__loadDialectModule =
  ConnectionManager.prototype._loadDialectModule;
ConnectionManager.prototype._loadDialectModule = function (...args) {
  const pg = this.__loadDialectModule(...args);
  pg.types.setTypeParser(20, function (val) {
    if (val > Number.MAX_SAFE_INTEGER) return String(val);
    else return parseInt(val, 10);
  });
  return pg;
};

QueryGenerator.prototype.__describeTableQuery =
  QueryGenerator.prototype.describeTableQuery;
QueryGenerator.prototype.describeTableQuery = function (...args) {
  const query = this.__describeTableQuery.call(this, ...args);
  return (
    query
      // Cast integer to string to avoid concatenation error beetween string and integer
      // The || is needed to avoid replacing in the wrong place
      .replace(
        '|| c.character_maximum_length',
        '|| CAST(c.character_maximum_length AS STRING)'
      )
      // Change unimplemented table
      .replace('pg_statio_all_tables', 'pg_class')
      // Change unimplemented column
      .replace('relid', 'oid')
  );
};

QueryGenerator.prototype.__fromArray = QueryGenerator.prototype.fromArray;
QueryGenerator.prototype.fromArray = function (text) {
  const patchedText = typeof text === 'string' ? text : `{${text.join(',')}}`;
  return this.__fromArray.call(this, patchedText);
};

// [5] Allow BigInts on `Model.findByPk`
// Copied from https://github.com/sequelize/sequelize/blob/29901187d9560e7d51ae1f9b5f411cf0c5d8994a/lib/model.js#L1866
// Added `bigint` to list of valid types.
// Works on v5 as well.
const Utils = require('sequelize/lib/utils');
Model.findByPk = async function findByPk(param, options) {
  // return Promise resolved with null if no arguments are passed
  if ([null, undefined].includes(param)) {
    return null;
  }

  options = Utils.cloneDeep(options) || {};

  if (
    ['number', 'string', 'bigint'].includes(typeof param) ||
    Buffer.isBuffer(param)
  ) {
    options.where = {
      [this.primaryKeyAttribute]: param
    };
  } else {
    throw new Error(`Argument passed to findByPk is invalid: ${param}`);
  }

  // Bypass a possible overloaded findOne
  return await this.findOne(options);
};

// [6] Skips searching for err.fields
// CRDB does not work with "details" at error level, so Sequelize does not generate this error properly.
// Copied from: https://github.com/sequelize/sequelize/blob/29901187d9560e7d51ae1f9b5f411cf0c5d8994a/lib/model.js#L2270
Model.findOrCreate = async function findOrCreate(options) {
  const _ = require('lodash');
  const Utils = require('sequelize/lib/utils.js');
  const { logger } = require('sequelize/lib/utils/logger');
  const sequelizeErrors = require('sequelize/lib/errors');

  if (!options || !options.where || arguments.length > 1) {
    throw new Error(
      'Missing where attribute in the options parameter passed to findOrCreate. ' +
        'Please note that the API has changed, and is now options only (an object with where, defaults keys, transaction etc.)'
    );
  }

  options = { ...options };

  if (options.defaults) {
    const defaults = Object.keys(options.defaults);
    const unknownDefaults = defaults.filter(name => !this.rawAttributes[name]);

    if (unknownDefaults.length) {
      logger.warn(
        `Unknown attributes (${unknownDefaults}) passed to defaults option of findOrCreate`
      );
    }
  }

  if (options.transaction === undefined && this.sequelize.constructor._cls) {
    const t = this.sequelize.constructor._cls.get('transaction');
    if (t) {
      options.transaction = t;
    }
  }

  const internalTransaction = !options.transaction;
  let values;
  let transaction;

  try {
    const t = await this.sequelize.transaction(options);
    transaction = t;
    options.transaction = t;

    const found = await this.findOne(Utils.defaults({ transaction }, options));
    if (found !== null) {
      return [found, false];
    }

    values = { ...options.defaults };
    if (_.isPlainObject(options.where)) {
      values = Utils.defaults(values, options.where);
    }

    options.exception = true;
    options.returning = true;

    try {
      const created = await this.create(values, options);
      if (created.get(this.primaryKeyAttribute, { raw: true }) === null) {
        // If the query returned an empty result for the primary key, we know that this was actually a unique constraint violation
        throw new sequelizeErrors.UniqueConstraintError();
      }

      return [created, true];
    } catch (err) {
      if (!(err instanceof sequelizeErrors.UniqueConstraintError)) throw err;
      const flattenedWhere = Utils.flattenObjectDeep(options.where);
      const flattenedWhereKeys = Object.keys(flattenedWhere).map(name =>
        _.last(name.split('.'))
      );
      const whereFields = flattenedWhereKeys.map(name =>
        _.get(this.rawAttributes, `${name}.field`, name)
      );
      const defaultFields =
        options.defaults &&
        Object.keys(options.defaults)
          .filter(name => this.rawAttributes[name])
          .map(name => this.rawAttributes[name].field || name);

      // This line differs from the original findOrCreate. Added {} to bypass the .fields requesting.
      // This issue: https://github.com/cockroachdb/cockroach/issues/63332 could probably change the
      // need for this adaptation.
      const errFieldKeys = Object.keys(err.fields || {});
      const errFieldsWhereIntersects = Utils.intersects(
        errFieldKeys,
        whereFields
      );
      if (
        defaultFields &&
        !errFieldsWhereIntersects &&
        Utils.intersects(errFieldKeys, defaultFields)
      ) {
        throw err;
      }

      if (errFieldsWhereIntersects) {
        _.each(err.fields, (value, key) => {
          const name = this.fieldRawAttributesMap[key].fieldName;
          if (value.toString() !== options.where[name].toString()) {
            throw new Error(
              `${this.name}#findOrCreate: value used for ${name} was not equal for both the find and the create calls, '${options.where[name]}' vs '${value}'`
            );
          }
        });
      }

      // Someone must have created a matching instance inside the same transaction since we last did a find. Let's find it!
      const otherCreated = await this.findOne(
        Utils.defaults(
          {
            transaction: internalTransaction ? null : transaction
          },
          options
        )
      );

      // Sanity check, ideally we caught this at the defaultFeilds/err.fields check
      // But if we didn't and instance is null, we will throw
      if (otherCreated === null) throw err;

      return [otherCreated, false];
    }
  } finally {
    if (internalTransaction && transaction) {
      await transaction.commit();
    }
  }
};

// [7] GEOGRAPHY type
// Got to explicitly cast it is a GEOGRAPHY type.
DataTypes.postgres.GEOGRAPHY.prototype.bindParam = (value, options) => {
  return `ST_GeomFromGeoJSON(${options.bindParam(value)}::json)::geography`;
}

//// Done!

Sequelize.supportsCockroachDB = true;
module.exports = require('sequelize');
