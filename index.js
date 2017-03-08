// Copyright 2017 The Cockroach Authors.
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

var Sequelize = require('sequelize');
var QueryGenerator = require('sequelize/lib/dialects/postgres/query-generator.js');
var QueryTypes = require('sequelize/lib/query-types.js');

var upsertIssueURL = "https://github.com/cockroachdb/cockroach/issues/6637";

// upsertQuery generates an upsert query using INSERT with an ON CONFLICT
// clause. This overrides the Sequelize implementation for Postgres, which uses
// a temporary stored procedure to handle upserts.
//
// Unlike the implementations of this method by other dialects, this method has
// no return value.
QueryGenerator.upsertQuery = function(tableName, insertValues, updateValues, where, rawAttributes, options) {
  var self = this;
  if (options.returning) {
    throw new Error("RETURNING not supported with INSERT .. ON CONFLICT. See " + upsertIssueURL);
  }

  // Though this is an upsert, we want Sequelize to treat this as an INSERT.
  // Sequelize treats upserts in Postgres as a call to a temporary stored
  // procedure, which has a different return type than an INSERT.
  options.type = QueryTypes.INSERT;
  delete options.returning;

  // Create base INSERT query.
  var insert = this.insertQuery(tableName, insertValues, rawAttributes, options);
  if (insert.slice(-1) !== ";") {
    throw new Error("expected but did not find terminating semicolon in INSERT query");
  }
  insert = insert.slice(0, -1);

  // Create the ON CONFLICT clause, using the primary key as the target.
  var pkCols = [];
  Object.keys(rawAttributes).forEach(function(key) {
    if (rawAttributes[key].primaryKey) {
      pkCols.push(self.quoteIdentifier(rawAttributes[key].field));
    }
  });
  var onConflictSet = Object.keys(updateValues).map(function (key) {
    key = this.quoteIdentifier(key);
    return key + ' = excluded.'+key;
  }, this).join(', ');

  console.log(insert + " ON CONFlICT (" + pkCols.join(',') + ") DO UPDATE SET " + onConflictSet + ";");
  return insert + " ON CONFlICT (" + pkCols.join(',') + ") DO UPDATE SET " + onConflictSet + ";";
}

Sequelize.supportsCockroachDB = true;

/**
  * The entry point.
  *
  * @module Sequelize
  */
module.exports = Sequelize;
