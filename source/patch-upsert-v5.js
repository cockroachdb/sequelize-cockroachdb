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

const { Model, DataTypes, QueryTypes } = require('sequelize');
const _ = require('lodash');
const uuidv4 = require('uuid').v4;
const Promise = require('sequelize/lib/promise');
const Utils = require('sequelize/lib/utils');
const { logger } = require('sequelize/lib/utils/logger');
const debug = logger.debugContext('sql:pg');

const queryInterfacePatches = {
  // Note: copied from Sequelize v6 source code with minor tweaks
  upsert(tableName, insertValues, updateValues, where, model, options) {
    options = _.clone(options);

    const primaryKeys = Object.values(model.primaryKeys).map(
      item => item.field
    );
    const uniqueKeys = Object.values(model.uniqueKeys)
      .filter(c => c.fields.length >= 1)
      .map(c => c.fields);
    const indexKeys = Object.values(model._indexes)
      .filter(c => c.unique && c.fields.length >= 1)
      .map(c => c.fields);

    options.type = QueryTypes.UPSERT;
    options.updateOnDuplicate = Object.keys(updateValues);
    options.upsertKeys = [];

    // For fields in updateValues, try to find a constraint or unique index
    // that includes given field. Only first matching upsert key is used.
    for (const field of options.updateOnDuplicate) {
      const uniqueKey = uniqueKeys.find(fields => fields.includes(field));
      if (uniqueKey) {
        options.upsertKeys = uniqueKey;
        break;
      }

      const indexKey = indexKeys.find(fields => fields.includes(field));
      if (indexKey) {
        options.upsertKeys = indexKey;
        break;
      }
    }

    // Always use PK, if no constraint available OR update data contains PK
    if (
      options.upsertKeys.length === 0 ||
      _.intersection(options.updateOnDuplicate, primaryKeys).length
    ) {
      options.upsertKeys = primaryKeys;
    }

    options.upsertKeys = _.uniq(options.upsertKeys);

    const sql = this.QueryGenerator.insertQuery(
      tableName,
      insertValues,
      model.rawAttributes,
      options
    );
    return this.sequelize.query(sql, options);
  }
};

const queryGeneratorPatches = {
  // Note: copied from Sequelize v6 source code with minor tweaks
  generateReturnValues(modelAttributes, options) {
    const returnFields = [];
    const returnTypes = [];
    let outputFragment = '';
    let returningFragment = '';
    let tmpTable = '';

    if (Array.isArray(options.returning)) {
      returnFields.push(
        ...options.returning.map(field => this.quoteIdentifier(field))
      );
    } else if (modelAttributes) {
      _.each(modelAttributes, attribute => {
        if (!(attribute.type instanceof DataTypes.VIRTUAL)) {
          returnFields.push(this.quoteIdentifier(attribute.field));
          returnTypes.push(attribute.type);
        }
      });
    }

    if (_.isEmpty(returnFields)) {
      returnFields.push('*');
    }

    if (this._dialect.supports.returnValues.returning) {
      returningFragment = ` RETURNING ${returnFields.join(',')}`;
    } else if (this._dialect.supports.returnValues.output) {
      outputFragment = ` OUTPUT ${returnFields
        .map(field => `INSERTED.${field}`)
        .join(',')}`;

      //To capture output rows when there is a trigger on MSSQL DB
      if (options.hasTrigger && this._dialect.supports.tmpTableTrigger) {
        const tmpColumns = returnFields.map(
          (field, i) => `${field} ${returnTypes[i].toSql()}`
        );

        tmpTable = `DECLARE @tmp TABLE (${tmpColumns.join(',')}); `;
        outputFragment += ' INTO @tmp';
        returningFragment = '; SELECT * FROM @tmp';
      }
    }

    return { outputFragment, returnFields, returningFragment, tmpTable };
  },

  // Note: copied from Sequelize v6 source code with minor tweaks
  insertQuery(table, valueHash, modelAttributes, options) {
    options = options || {};
    _.defaults(options, this.options);

    const modelAttributeMap = {};
    const bind = [];
    const fields = [];
    const returningModelAttributes = [];
    const values = [];
    const quotedTable = this.quoteTable(table);
    const bindParam =
      options.bindParam === undefined
        ? this.bindParam(bind)
        : options.bindParam;
    let query;
    let valueQuery = '';
    let emptyQuery = '';
    let outputFragment = '';
    let returningFragment = '';
    let identityWrapperRequired = false;
    let tmpTable = ''; //tmpTable declaration for trigger

    if (modelAttributes) {
      _.each(modelAttributes, (attribute, key) => {
        modelAttributeMap[key] = attribute;
        if (attribute.field) {
          modelAttributeMap[attribute.field] = attribute;
        }
      });
    }

    if (this._dialect.supports['DEFAULT VALUES']) {
      emptyQuery += ' DEFAULT VALUES';
    } else if (this._dialect.supports['VALUES ()']) {
      emptyQuery += ' VALUES ()';
    }

    if (this._dialect.supports.returnValues && options.returning) {
      const returnValues = this.generateReturnValues(modelAttributes, options);

      returningModelAttributes.push(...returnValues.returnFields);
      returningFragment = returnValues.returningFragment;
      tmpTable = returnValues.tmpTable || '';
      outputFragment = returnValues.outputFragment || '';
    }

    if (
      _.get(this, [
        'sequelize',
        'options',
        'dialectOptions',
        'prependSearchPath'
      ]) ||
      options.searchPath
    ) {
      // Not currently supported with search path (requires output of multiple queries)
      options.bindParam = false;
    }

    if (this._dialect.supports.EXCEPTION && options.exception) {
      // Not currently supported with bind parameters (requires output of multiple queries)
      options.bindParam = false;
    }

    valueHash = Utils.removeNullValuesFromHash(
      valueHash,
      this.options.omitNull
    );
    for (const key in valueHash) {
      if (Object.prototype.hasOwnProperty.call(valueHash, key)) {
        const value = valueHash[key];
        fields.push(this.quoteIdentifier(key));

        // SERIALS' can't be NULL in postgresql, use DEFAULT where supported
        if (
          modelAttributeMap &&
          modelAttributeMap[key] &&
          modelAttributeMap[key].autoIncrement === true &&
          !value
        ) {
          if (!this._dialect.supports.autoIncrement.defaultValue) {
            fields.splice(-1, 1);
          } else if (this._dialect.supports.DEFAULT) {
            values.push('DEFAULT');
          } else {
            values.push(this.escape(null));
          }
        } else {
          if (
            modelAttributeMap &&
            modelAttributeMap[key] &&
            modelAttributeMap[key].autoIncrement === true
          ) {
            identityWrapperRequired = true;
          }

          if (
            value instanceof Utils.SequelizeMethod ||
            options.bindParam === false
          ) {
            values.push(
              this.escape(
                value,
                (modelAttributeMap && modelAttributeMap[key]) || undefined,
                { context: 'INSERT' }
              )
            );
          } else {
            values.push(
              this.format(
                value,
                (modelAttributeMap && modelAttributeMap[key]) || undefined,
                { context: 'INSERT' },
                bindParam
              )
            );
          }
        }
      }
    }

    let onDuplicateKeyUpdate = '';

    if (
      this._dialect.supports.inserts.updateOnDuplicate &&
      options.updateOnDuplicate
    ) {
      if (
        this._dialect.supports.inserts.updateOnDuplicate ==
        ' ON CONFLICT DO UPDATE SET'
      ) {
        // postgres / sqlite
        // If no conflict target columns were specified, use the primary key names from options.upsertKeys
        const conflictKeys = options.upsertKeys.map(attr =>
          this.quoteIdentifier(attr)
        );
        const updateKeys = options.updateOnDuplicate.map(
          attr =>
            `${this.quoteIdentifier(attr)}=EXCLUDED.${this.quoteIdentifier(
              attr
            )}`
        );
        onDuplicateKeyUpdate = ` ON CONFLICT (${conflictKeys.join(
          ','
        )}) DO UPDATE SET ${updateKeys.join(',')}`;
      } else {
        const valueKeys = options.updateOnDuplicate.map(
          attr =>
            `${this.quoteIdentifier(attr)}=VALUES(${this.quoteIdentifier(
              attr
            )})`
        );
        onDuplicateKeyUpdate += `${
          this._dialect.supports.inserts.updateOnDuplicate
        } ${valueKeys.join(',')}`;
      }
    }

    const replacements = {
      ignoreDuplicates: options.ignoreDuplicates
        ? this._dialect.supports.inserts.ignoreDuplicates
        : '',
      onConflictDoNothing: options.ignoreDuplicates
        ? this._dialect.supports.inserts.onConflictDoNothing
        : '',
      attributes: fields.join(','),
      output: outputFragment,
      values: values.join(','),
      tmpTable
    };

    valueQuery = `${tmpTable}INSERT${replacements.ignoreDuplicates} INTO ${quotedTable} (${replacements.attributes})${replacements.output} VALUES (${replacements.values})${onDuplicateKeyUpdate}${replacements.onConflictDoNothing}${valueQuery}`;
    emptyQuery = `${tmpTable}INSERT${replacements.ignoreDuplicates} INTO ${quotedTable}${replacements.output}${onDuplicateKeyUpdate}${replacements.onConflictDoNothing}${emptyQuery}`;

    // Mostly for internal use, so we expect the user to know what he's doing!
    // pg_temp functions are private per connection, so we never risk this function interfering with another one.
    if (this._dialect.supports.EXCEPTION && options.exception) {
      const dropFunction = 'DROP FUNCTION IF EXISTS pg_temp.testfunc()';

      if (returningModelAttributes.length === 0) {
        returningModelAttributes.push('*');
      }

      const delimiter = `$func_${uuidv4().replace(/-/g, '')}$`;
      const selectQuery = `SELECT (testfunc.response).${returningModelAttributes.join(
        ', (testfunc.response).'
      )}, testfunc.sequelize_caught_exception FROM pg_temp.testfunc();`;

      options.exception =
        'WHEN unique_violation THEN GET STACKED DIAGNOSTICS sequelize_caught_exception = PG_EXCEPTION_DETAIL;';
      valueQuery = `CREATE OR REPLACE FUNCTION pg_temp.testfunc(OUT response ${quotedTable}, OUT sequelize_caught_exception text) RETURNS RECORD AS ${delimiter} BEGIN ${valueQuery} RETURNING * INTO response; EXCEPTION ${options.exception} END ${delimiter} LANGUAGE plpgsql; ${selectQuery} ${dropFunction}`;
    } else {
      valueQuery += returningFragment;
      emptyQuery += returningFragment;
    }

    query = `${replacements.attributes.length ? valueQuery : emptyQuery};`;
    if (
      identityWrapperRequired &&
      this._dialect.supports.autoIncrement.identityInsert
    ) {
      query = `SET IDENTITY_INSERT ${quotedTable} ON; ${query} SET IDENTITY_INSERT ${quotedTable} OFF;`;
    }

    // Used by Postgres upsertQuery and calls to here with options.exception set to true
    const result = { query };
    if (options.bindParam !== false) {
      result.bind = bind;
    }

    return result;
  }
};

const postgresQueryPatches = {
  // Note: copied from Sequelize v6 source code with minor tweaks
  run(sql, parameters) {
    const { connection } = this;

    if (!_.isEmpty(this.options.searchPath)) {
      sql =
        this.sequelize
          .getQueryInterface()
          .QueryGenerator.setSearchPath(this.options.searchPath) + sql;
    }
    this.sql = sql;

    const query =
      parameters && parameters.length
        ? new Promise((resolve, reject) =>
            connection.query(sql, parameters, (error, result) =>
              error ? reject(error) : resolve(result)
            )
          )
        : new Promise((resolve, reject) =>
            connection.query(sql, (error, result) =>
              error ? reject(error) : resolve(result)
            )
          );

    const complete = this._logQuery(sql, debug, parameters);

    return query
      .catch(err => {
        // set the client so that it will be reaped if the connection resets while executing
        if (err.code === 'ECONNRESET') {
          connection._invalid = true;
        }

        err.sql = sql;
        err.parameters = parameters;
        throw this.formatError(err);
      })
      .then(queryResult => {
        complete();

        let rows = Array.isArray(queryResult)
          ? queryResult.reduce((allRows, r) => allRows.concat(r.rows || []), [])
          : queryResult.rows;
        const rowCount = Array.isArray(queryResult)
          ? queryResult.reduce(
              (count, r) =>
                Number.isFinite(r.rowCount) ? count + r.rowCount : count,
              0
            )
          : queryResult.rowCount || 0;

        if (
          this.sequelize.options.minifyAliases &&
          this.options.aliasesMapping
        ) {
          rows = rows.map(row =>
            _.toPairs(row).reduce((acc, [key, value]) => {
              const mapping = this.options.aliasesMapping.get(key);
              acc[mapping || key] = value;
              return acc;
            }, {})
          );
        }

        const isTableNameQuery = sql.startsWith(
          'SELECT table_name FROM information_schema.tables'
        );
        const isRelNameQuery = sql.startsWith(
          'SELECT relname FROM pg_class WHERE oid IN'
        );

        if (isRelNameQuery) {
          return rows.map(row => ({
            name: row.relname,
            tableName: row.relname.split('_')[0]
          }));
        }
        if (isTableNameQuery) {
          return rows.map(row => _.values(row));
        }

        if (rows[0] && rows[0].sequelize_caught_exception !== undefined) {
          if (rows[0].sequelize_caught_exception !== null) {
            throw this.formatError({
              code: '23505',
              detail: rows[0].sequelize_caught_exception
            });
          }
          for (const row of rows) {
            delete row.sequelize_caught_exception;
          }
        }

        if (this.isShowIndexesQuery()) {
          for (const row of rows) {
            const attributes = /ON .*? (?:USING .*?\s)?\(([^]*)\)/gi
              .exec(row.definition)[1]
              .split(',');

            // Map column index in table to column name
            const columns = _.zipObject(
              row.column_indexes,
              this.sequelize
                .getQueryInterface()
                .QueryGenerator.fromArray(row.column_names)
            );
            delete row.column_indexes;
            delete row.column_names;

            let field;
            let attribute;

            // Indkey is the order of attributes in the index, specified by a string of attribute indexes
            row.fields = row.indkey
              .split(' ')
              .map((indKey, index) => {
                field = columns[indKey];
                // for functional indices indKey = 0
                if (!field) {
                  return null;
                }
                attribute = attributes[index];
                return {
                  attribute: field,
                  collate: attribute.match(/COLLATE "(.*?)"/)
                    ? /COLLATE "(.*?)"/.exec(attribute)[1]
                    : undefined,
                  order: attribute.includes('DESC')
                    ? 'DESC'
                    : attribute.includes('ASC')
                    ? 'ASC'
                    : undefined,
                  length: undefined
                };
              })
              .filter(n => n !== null);
            delete row.columns;
          }
          return rows;
        }
        if (this.isForeignKeysQuery()) {
          const result = [];
          for (const row of rows) {
            let defParts;
            if (
              row.condef !== undefined &&
              (defParts = row.condef.match(
                /FOREIGN KEY \((.+)\) REFERENCES (.+)\((.+)\)( ON (UPDATE|DELETE) (CASCADE|RESTRICT))?( ON (UPDATE|DELETE) (CASCADE|RESTRICT))?/
              ))
            ) {
              row.id = row.constraint_name;
              row.table = defParts[2];
              row.from = defParts[1];
              row.to = defParts[3];
              let i;
              for (i = 5; i <= 8; i += 3) {
                if (/(UPDATE|DELETE)/.test(defParts[i])) {
                  row[`on_${defParts[i].toLowerCase()}`] = defParts[i + 1];
                }
              }
            }
            result.push(row);
          }
          return result;
        }
        if (this.isSelectQuery()) {
          let result = rows;
          // Postgres will treat tables as case-insensitive, so fix the case
          // of the returned values to match attributes
          if (
            this.options.raw === false &&
            this.sequelize.options.quoteIdentifiers === false
          ) {
            const attrsMap = _.reduce(
              this.model.rawAttributes,
              (m, v, k) => {
                m[k.toLowerCase()] = k;
                return m;
              },
              {}
            );
            result = rows.map(row => {
              return _.mapKeys(row, (value, key) => {
                const targetAttr = attrsMap[key];
                if (typeof targetAttr === 'string' && targetAttr !== key) {
                  return targetAttr;
                }
                return key;
              });
            });
          }
          return this.handleSelectQuery(result);
        }
        if (QueryTypes.DESCRIBE === this.options.type) {
          const result = {};

          for (const row of rows) {
            result[row.Field] = {
              type: row.Type.toUpperCase(),
              allowNull: row.Null === 'YES',
              defaultValue: row.Default,
              comment: row.Comment,
              special: row.special
                ? this.sequelize
                    .getQueryInterface()
                    .QueryGenerator.fromArray(row.special)
                : [],
              primaryKey: row.Constraint === 'PRIMARY KEY'
            };

            if (result[row.Field].type === 'BOOLEAN') {
              result[row.Field].defaultValue = { false: false, true: true }[
                result[row.Field].defaultValue
              ];

              if (result[row.Field].defaultValue === undefined) {
                result[row.Field].defaultValue = null;
              }
            }

            if (typeof result[row.Field].defaultValue === 'string') {
              result[row.Field].defaultValue = result[
                row.Field
              ].defaultValue.replace(/'/g, '');

              if (result[row.Field].defaultValue.includes('::')) {
                const split = result[row.Field].defaultValue.split('::');
                if (split[1].toLowerCase() !== 'regclass)') {
                  result[row.Field].defaultValue = split[0];
                }
              }
            }
          }

          return result;
        }
        if (this.isVersionQuery()) {
          return rows[0].server_version;
        }
        if (this.isShowOrDescribeQuery()) {
          return rows;
        }
        if (QueryTypes.BULKUPDATE === this.options.type) {
          if (!this.options.returning) {
            return parseInt(rowCount, 10);
          }
          return this.handleSelectQuery(rows);
        }
        if (QueryTypes.BULKDELETE === this.options.type) {
          return parseInt(rowCount, 10);
        }
        if (
          this.isInsertQuery() ||
          this.isUpdateQuery() ||
          this.isUpsertQuery()
        ) {
          if (this.instance && this.instance.dataValues) {
            for (const key in rows[0]) {
              if (Object.prototype.hasOwnProperty.call(rows[0], key)) {
                const record = rows[0][key];

                const attr = _.find(
                  this.model.rawAttributes,
                  attribute =>
                    attribute.fieldName === key || attribute.field === key
                );

                this.instance.dataValues[
                  (attr && attr.fieldName) || key
                ] = record;
              }
            }
          }

          if (this.isUpsertQuery()) {
            return [this.instance, null];
          }

          return [
            this.instance ||
              (rows && ((this.options.plain && rows[0]) || rows)) ||
              undefined,
            rowCount
          ];
        }
        if (this.isRawQuery()) {
          return [rows, queryResult];
        }
        return rows;
      });
  }
};

const modelPatches = {
  static: {
    // Note: copied from Sequelize v6 source code with minor tweaks
    upsert(values, options) {
      options = {
        hooks: true,
        returning: true,
        validate: true,
        ...Utils.cloneDeep(options)
      };

      const createdAtAttr = this._timestampAttributes.createdAt;
      const updatedAtAttr = this._timestampAttributes.updatedAt;
      const hasPrimary =
        this.primaryKeyField in values || this.primaryKeyAttribute in values;
      const instance = this.build(values);

      options.model = this;
      options.instance = instance;

      if (!options.fields) {
        options.fields = Object.keys(instance._changed);
      }

      return Promise.try(() => {
        if (options.validate) {
          return instance.validate(options);
        }
      }).then(() => {
        // Map field names
        const updatedDataValues = _.pick(
          instance.dataValues,
          Object.keys(instance._changed)
        );
        const insertValues = Utils.mapValueFieldNames(
          instance.dataValues,
          Object.keys(instance.rawAttributes),
          this
        );
        const updateValues = Utils.mapValueFieldNames(
          updatedDataValues,
          options.fields,
          this
        );
        const now = Utils.now(this.sequelize.options.dialect);

        // Attach createdAt
        if (createdAtAttr && !updateValues[createdAtAttr]) {
          const field =
            this.rawAttributes[createdAtAttr].field || createdAtAttr;
          insertValues[field] = this._getDefaultTimestamp(createdAtAttr) || now;
        }
        if (updatedAtAttr && !insertValues[updatedAtAttr]) {
          const field =
            this.rawAttributes[updatedAtAttr].field || updatedAtAttr;
          insertValues[field] = updateValues[field] =
            this._getDefaultTimestamp(updatedAtAttr) || now;
        }

        // Build adds a null value for the primary key, if none was given by the user.
        // We need to remove that because of some Postgres technicalities.
        if (
          !hasPrimary &&
          this.primaryKeyAttribute &&
          !this.rawAttributes[this.primaryKeyAttribute].defaultValue
        ) {
          delete insertValues[this.primaryKeyField];
          delete updateValues[this.primaryKeyField];
        }

        return Promise.try(() => {
          if (options.hooks) {
            return this.runHooks('beforeUpsert', values, options);
          }
        })
          .then(() => {
            return this.QueryInterface.upsert(
              this.getTableName(options),
              insertValues,
              updateValues,
              instance.where(),
              this,
              options
            );
          })
          .tap(result => {
            const [record] = result;
            record.isNewRecord = false;
            if (options.hooks) {
              return this.runHooks('afterUpsert', result, options);
            }
          });
      });
    }
  }
};

// Apply patches

const QueryInterface = require('sequelize/lib/query-interface');
const QueryGenerator = require('sequelize/lib/dialects/abstract/query-generator');
const PostgresQuery = require('sequelize/lib/dialects/postgres/query');

QueryInterface.prototype.upsert = queryInterfacePatches.upsert;
QueryGenerator.prototype.generateReturnValues =
  queryGeneratorPatches.generateReturnValues;
QueryGenerator.prototype.insertQuery = queryGeneratorPatches.insertQuery;
PostgresQuery.prototype.run = postgresQueryPatches.run;
Model.upsert = modelPatches.static.upsert;
