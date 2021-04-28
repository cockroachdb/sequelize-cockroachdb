'use strict';

const { expect } = require('chai');
const { DataTypes } = require('../source');

const Support = {
  dropTestSchemas: async sequelize => {
    const schemas = await sequelize.showAllSchemas();
    const schemasPromise = [];
    schemas.forEach(schema => {
      const schemaName = schema.name ? schema.name : schema;
      if (schemaName !== sequelize.config.database) {
        schemasPromise.push(sequelize.dropSchema(schemaName));
      }
    });

    await Promise.all(schemasPromise.map(p => p.catch(e => e)));
  }
};

describe('QueryInterface', () => {
  beforeEach(function () {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(async function () {
    await Support.dropTestSchemas(this.sequelize);
  });

  describe('removeColumn', () => {
    describe('(without a schema)', () => {
      beforeEach(async function () {
        await this.queryInterface.createTable('users', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
          },
          firstName: {
            type: DataTypes.STRING,
            defaultValue: 'Someone'
          },
          lastName: {
            type: DataTypes.STRING
          },
          manager: {
            type: DataTypes.INTEGER,
            references: {
              model: 'users',
              key: 'id'
            }
          },
          email: {
            type: DataTypes.STRING,
            unique: true
          }
        });
      });

      // Reason: In CockroachDB, dropping a Primary Key column is restricted.
      it.skip('should be able to remove a column with primaryKey', async function () {
        await this.queryInterface.removeColumn('users', 'manager');
        const table0 = await this.queryInterface.describeTable('users');
        expect(table0).to.not.have.property('manager');
        try {
          await this.queryInterface.removeColumn('users', 'id');
        } catch (err) {
          console.log(err);
        }
        const table = await this.queryInterface.describeTable('users');
        expect(table).to.not.have.property('id');
      });
    });

    describe('(with a schema)', () => {
      beforeEach(async function () {
        await this.sequelize.createSchema('archive');

        await this.queryInterface.createTable(
          {
            tableName: 'users',
            schema: 'archive'
          },
          {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true
            },
            firstName: {
              type: DataTypes.STRING,
              defaultValue: 'Someone'
            },
            lastName: {
              type: DataTypes.STRING
            },
            email: {
              type: DataTypes.STRING,
              unique: true
            }
          }
        );
      });

      // Reason: In CockroachDB, dropping a Primary Key column is restricted.
      it.skip('should be able to remove a column with primaryKey', async function () {
        await this.queryInterface.removeColumn(
          {
            tableName: 'users',
            schema: 'archive'
          },
          'id'
        );

        const table = await this.queryInterface.describeTable({
          tableName: 'users',
          schema: 'archive'
        });

        expect(table).to.not.have.property('id');
      });
    });
  });
});
