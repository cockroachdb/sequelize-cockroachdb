'use strict';

const { expect } = require('chai');
const { DataTypes } = require('../source');
const dialect = 'postgres';

const Support = {
  dropTestSchemas: async (sequelize) => {
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
  beforeEach(function() {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(async function() {
    await Support.dropTestSchemas(this.sequelize);
  });

  describe('changeColumn', () => {
    // Reason: ALTER COLUMN TYPE from int to float is prohibited until v21.1
    it.skip('should support schemas', async function() {
      await this.sequelize.createSchema('archive');

      await this.queryInterface.createTable({
        tableName: 'users',
        schema: 'archive'
      }, {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        currency: DataTypes.INTEGER
      });

      await this.queryInterface.changeColumn({
        tableName: 'users',
        schema: 'archive'
      }, 'currency', {
        type: DataTypes.FLOAT
      });

      const table = await this.queryInterface.describeTable({
        tableName: 'users',
        schema: 'archive'
      });

      if (dialect === 'postgres' || dialect === 'postgres-native') {
        expect(table.currency.type).to.equal('DOUBLE PRECISION');
      } else {
        expect(table.currency.type).to.equal('FLOAT');
      }
    });

    // Reason: ALTER COLUMN TYPE from int to float is prohibited until v21.1
    it.skip('should change columns', async function() {
      await this.queryInterface.createTable({
        tableName: 'users'
      }, {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        currency: DataTypes.INTEGER
      });

      await this.queryInterface.changeColumn('users', 'currency', {
        type: DataTypes.FLOAT,
        allowNull: true
      });

      const table = await this.queryInterface.describeTable({
        tableName: 'users'
      });

      if (dialect === 'postgres' || dialect === 'postgres-native') {
        expect(table.currency.type).to.equal('DOUBLE PRECISION');
      } else {
        expect(table.currency.type).to.equal('FLOAT');
      }
    });

    //Reason: ALTER COLUMN TYPE from varchar to enum_users_firstName is prohibited until v21.1
    it.skip('should work with enums (case 1)', async function() {
      await this.queryInterface.createTable({
        tableName: 'users'
      }, {
        firstName: DataTypes.STRING
      });

      await this.queryInterface.changeColumn('users', 'firstName', {
        type: DataTypes.ENUM(['value1', 'value2', 'value3'])
      });
    });

    // Reason: ALTER COLUMN TYPE from varchar to enum_users_firstName is prohibited until v21.1
    it.skip('should work with enums (case 2)', async function() {
      await this.queryInterface.createTable({
        tableName: 'users'
      }, {
        firstName: DataTypes.STRING
      });

      await this.queryInterface.changeColumn('users', 'firstName', {
        type: DataTypes.ENUM,
        values: ['value1', 'value2', 'value3']
      });
    });

    // Reason: ALTER COLUMN TYPE from varchar to enum_users_firstName is prohibited until v21.1
    it.skip('should work with enums with schemas', async function() {
      await this.sequelize.createSchema('archive');

      await this.queryInterface.createTable({
        tableName: 'users',
        schema: 'archive'
      }, {
        firstName: DataTypes.STRING
      });

      await this.queryInterface.changeColumn({
        tableName: 'users',
        schema: 'archive'
      }, 'firstName', {
        type: DataTypes.ENUM(['value1', 'value2', 'value3'])
      });
    });

    describe('should support foreign keys', () => {
      beforeEach(async function() {
        await this.queryInterface.createTable('users', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
          },
          level_id: {
            type: DataTypes.INTEGER,
            allowNull: false
          }
        });

        await this.queryInterface.createTable('level', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
          }
        });
      });

      it('able to change column to foreign key', async function() {
        const foreignKeys = await this.queryInterface.getForeignKeyReferencesForTable('users');
        expect(foreignKeys).to.be.an('array');
        expect(foreignKeys).to.be.empty;

        await this.queryInterface.changeColumn('users', 'level_id', {
          type: DataTypes.INTEGER,
          references: {
            model: 'level',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        });

        const newForeignKeys = await this.queryInterface.getForeignKeyReferencesForTable('users');
        expect(newForeignKeys).to.be.an('array');
        expect(newForeignKeys).to.have.lengthOf(1);
        expect(newForeignKeys[0].columnName).to.be.equal('level_id');
      });

      it('able to change column property without affecting other properties', async function() {
        // 1. look for users table information
        // 2. change column level_id on users to have a Foreign Key
        // 3. look for users table Foreign Keys information
        // 4. change column level_id AGAIN to allow null values
        // 5. look for new foreign keys information
        // 6. look for new table structure information
        // 7. compare foreign keys and tables(before and after the changes)
        const firstTable = await this.queryInterface.describeTable({
          tableName: 'users'
        });

        await this.queryInterface.changeColumn('users', 'level_id', {
          type: DataTypes.INTEGER,
          references: {
            model: 'level',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        });

        const keys = await this.queryInterface.getForeignKeyReferencesForTable('users');
        const firstForeignKeys = keys;

        await this.queryInterface.changeColumn('users', 'level_id', {
          type: DataTypes.INTEGER,
          allowNull: true
        });

        const newForeignKeys = await this.queryInterface.getForeignKeyReferencesForTable('users');
        expect(firstForeignKeys.length).to.be.equal(newForeignKeys.length);
        expect(firstForeignKeys[0].columnName).to.be.equal('level_id');
        expect(firstForeignKeys[0].columnName).to.be.equal(newForeignKeys[0].columnName);

        const describedTable = await this.queryInterface.describeTable({
          tableName: 'users'
        });

        expect(describedTable.level_id).to.have.property('allowNull');
        expect(describedTable.level_id.allowNull).to.not.equal(firstTable.level_id.allowNull);
        expect(describedTable.level_id.allowNull).to.be.equal(true);
      });

      it('should change the comment of column', async function() {
        const describedTable = await this.queryInterface.describeTable({
          tableName: 'users'
        });

        expect(describedTable.level_id.comment).to.be.equal(null);

        await this.queryInterface.changeColumn('users', 'level_id', {
          type: DataTypes.INTEGER,
          comment: 'FooBar'
        });

        const describedTable2 = await this.queryInterface.describeTable({ tableName: 'users' });
        expect(describedTable2.level_id.comment).to.be.equal('FooBar');
      });
    });
  });
});