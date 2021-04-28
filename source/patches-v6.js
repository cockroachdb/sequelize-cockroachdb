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
