const {
  PostgresQueryInterface
} = require('sequelize/lib/dialects/postgres/query-interface');

PostgresQueryInterface.prototype.__dropSchema =
  PostgresQueryInterface.prototype.dropSchema;

PostgresQueryInterface.prototype.dropSchema = async function (
  tableName,
  options
) {
  if (tableName === 'crdb_internal') return;

  await this.__dropSchema(tableName, options);
};

PostgresQueryInterface.prototype.__removeConstraint =
  PostgresQueryInterface.prototype.removeConstraint;

PostgresQueryInterface.prototype.removeConstraint = async function (
  tableName,
  constraintName,
  options
) {
  try {
    await this.__removeConstraint(tableName, constraintName, options);
  } catch (error) {
    if (error.message.includes('use DROP INDEX CASCADE instead')) {
      const query = this.queryGenerator.removeConstraintQuery(
        tableName,
        constraintName
      );
      const [, queryConstraintName] = query.split('DROP CONSTRAINT');
      const newQuery = `DROP INDEX ${queryConstraintName} CASCADE;`;

      return this.sequelize.query(newQuery, options);
    } else throw error;
  }
};

// Model.bulkCreate assigns the rows returned by bulkInsert to its instances by
// position. CockroachDB does not return the rows of
// INSERT ... ON CONFLICT DO UPDATE ... RETURNING in the order of the VALUES
// list: the conflict check is planned as a join against the conflict index,
// and rows that were updated can be returned before rows that were inserted.
// Reorder the returned rows so that they line up with the input records again,
// using the conflict target (upsertKeys) to identify each row.
PostgresQueryInterface.prototype.__bulkInsert =
  PostgresQueryInterface.prototype.bulkInsert;

PostgresQueryInterface.prototype.bulkInsert = async function (
  tableName,
  records,
  options,
  attributes
) {
  const results = await this.__bulkInsert(
    tableName,
    records,
    options,
    attributes
  );
  if (
    !options ||
    !options.updateOnDuplicate ||
    !Array.isArray(options.upsertKeys) ||
    options.upsertKeys.length === 0
  ) {
    return results;
  }
  return matchRowsToRecords(results, records, options.upsertKeys, attributes);
};

// Returns a string that identifies a value of a conflict target column, or
// undefined if the value cannot be compared with the value that the database
// returns (e.g. Sequelize.fn or Sequelize.literal).
function conflictKeyPart(value, attribute) {
  if (value instanceof Date) return `date:${value.getTime()}`;
  if (Buffer.isBuffer(value)) return `bytes:${value.toString('hex')}`;
  if (typeof value === 'string') {
    // CockroachDB returns UUIDs in lowercase.
    const isUUID = attribute && attribute.type && attribute.type.key === 'UUID';
    return isUUID ? value.toLowerCase() : value;
  }
  if (['number', 'bigint', 'boolean'].includes(typeof value)) {
    return String(value);
  }
  return undefined;
}

// Returns the conflict key of a record or returned row, null if the row can
// never conflict (a conflict target column is NULL or DEFAULT), or undefined if
// the key cannot be computed.
function conflictKey(row, upsertKeys, attributes) {
  const parts = [];
  for (const key of upsertKeys) {
    const value = row[key];
    if (value === null || value === undefined) return null;
    const part = conflictKeyPart(value, attributes && attributes[key]);
    if (part === undefined) return undefined;
    parts.push(part);
  }
  return JSON.stringify(parts);
}

// Returns the rows reordered to match the records, or the rows unchanged if
// they cannot be matched unambiguously.
function matchRowsToRecords(rows, records, upsertKeys, attributes) {
  if (!Array.isArray(rows) || rows.length !== records.length) return rows;

  // Records whose conflict key is NULL or DEFAULT are always inserted. Their
  // returned rows are matched in order, since CockroachDB returns inserted
  // rows in the order of the VALUES list.
  const unkeyedRecords = [];
  const recordsByKey = new Map();
  for (let i = 0; i < records.length; i++) {
    const key = conflictKey(records[i], upsertKeys, attributes);
    if (key === undefined) return rows;
    if (key === null) {
      unkeyedRecords.push(i);
    } else {
      if (!recordsByKey.has(key)) recordsByKey.set(key, []);
      // Duplicate keys are possible with a partial unique index, for records
      // that fall outside of the index predicate and are always inserted.
      recordsByKey.get(key).push(i);
    }
  }

  const matched = new Array(records.length);
  for (const row of rows) {
    const key = conflictKey(row, upsertKeys, attributes);
    const candidates = recordsByKey.get(key);
    let i;
    if (candidates && candidates.length > 0) {
      i = candidates.shift();
    } else if (unkeyedRecords.length > 0) {
      i = unkeyedRecords.shift();
    } else {
      return rows;
    }
    matched[i] = row;
  }
  // If a keyed record did not get its own row, some row was matched to the
  // wrong record, e.g. because the database normalized the key value.
  for (const candidates of recordsByKey.values()) {
    if (candidates.length > 0) return rows;
  }
  return matched;
}
