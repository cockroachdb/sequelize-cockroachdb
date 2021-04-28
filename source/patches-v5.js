const { QueryInterface } = require('sequelize/lib/query-interface');

QueryInterface.prototype.__dropSchema = QueryInterface.prototype.dropSchema;

QueryInterface.prototype.dropSchema = async function (tableName, options) {
  if (tableName === 'crdb_internal') return;

  await this.__dropSchema(tableName, options);
};

const QueryGenerator = require('sequelize/lib/dialects/abstract/query-generator');
QueryInterface.prototype.__removeConstraint =
  QueryInterface.prototype.removeConstraint;

QueryInterface.prototype.removeConstraint = async function (
  tableName,
  constraintName,
  options
) {
  try {
    await this.__removeConstraint(tableName, constraintName, options);
  } catch (error) {
    if (error.message.includes('use DROP INDEX CASCADE instead')) {
      const query = QueryGenerator.prototype.removeConstraintQuery.call(
        this,
        tableName,
        constraintName
      );
      const [, queryConstraintName] = query.split('DROP CONSTRAINT');
      const newQuery = `DROP INDEX ${queryConstraintName} CASCADE;`;

      return this.sequelize.query(newQuery, options);
    } else throw error;
  }
};
