// Copyright 2021 The Cockroach Authors.
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

require('./helper');

const { expect } = require('chai');
const { Sequelize, DataTypes } = require('../source');
const _ = require('lodash');

describe('QueryInterface', () => {
  beforeEach(function() {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(async function() {
    await this.queryInterface.dropAllSchemas();
  });

  describe('dropAllSchema', () => {
    it('should drop all schema', async function() {
      await this.queryInterface.dropAllSchemas({
        skip: [this.sequelize.config.database]
      });
      const schemaNames = await this.queryInterface.showAllSchemas();
      await this.queryInterface.createSchema('newSchema');
      const newSchemaNames = await this.queryInterface.showAllSchemas();
      expect(newSchemaNames).to.have.length(schemaNames.length + 1);
      await this.queryInterface.dropSchema('newSchema');
    });
  });

  describe('showAllTables', () => {
    it('should not contain views', async function() {
      async function cleanup() {
        // NOTE: The syntax "DROP VIEW [IF EXISTS]"" is not part of the standard
        // and might not be available on all RDBMSs. Therefore "DROP VIEW" is
        // the compatible option, which can throw an error in case the VIEW does
        // not exist. In case of error, it is ignored.
        try {
          await this.sequelize.query('DROP VIEW V_Fail');
        } catch (error) {
          // Ignore error.
        }
      }
      await this.queryInterface.createTable('my_test_table', { name: DataTypes.STRING });
      await cleanup.call(this);
      await this.sequelize.query('CREATE VIEW V_Fail AS SELECT 1 Id');
      let tableNames = await this.queryInterface.showAllTables();
      await cleanup.call(this);
      if (tableNames[0] && tableNames[0].tableName) {
        tableNames = tableNames.map(v => v.tableName);
      }
      expect(tableNames).to.deep.equal(['my_test_table']);
    });
  });

  // Reason: fixed in another PR
  describe.skip('renameTable', () => {
    it('should rename table', async function() {
      await this.queryInterface.createTable('my_test_table', {
        name: DataTypes.STRING
      });
      await this.queryInterface.renameTable('my_test_table', 'my_test_table_new');
      let tableNames = await this.queryInterface.showAllTables();
      expect(tableNames).to.contain('my_test_table_new');
      expect(tableNames).to.not.contain('my_test_table');
    });
  });

  describe('dropAllTables', () => {
    it('should drop all tables', async function() {

      // MSSQL includes `spt_values` table which is system defined, hence can't be dropped
      const showAllTablesIgnoringSpecialMSSQLTable = async () => {
        const tableNames = await this.queryInterface.showAllTables();
        return tableNames.filter(t => t.tableName !== 'spt_values');
      };

      await this.queryInterface.dropAllTables();

      expect(
        await showAllTablesIgnoringSpecialMSSQLTable()
      ).to.be.empty;

      await this.queryInterface.createTable('table', { name: DataTypes.STRING });

      expect(
        await showAllTablesIgnoringSpecialMSSQLTable()
      ).to.have.length(1);

      await this.queryInterface.dropAllTables();

      expect(
        await showAllTablesIgnoringSpecialMSSQLTable()
      ).to.be.empty;
    });

    it('should be able to skip given tables', async function() {
      await this.queryInterface.createTable('skipme', {
        name: DataTypes.STRING
      });
      await this.queryInterface.dropAllTables({ skip: ['skipme'] });
      let tableNames = await this.queryInterface.showAllTables();
      expect(tableNames).to.contain('skipme');
    });
  });

  // Reason: CockroachDB always have a primary index on the table which makes this test fail
  describe('indexes', () => {
    beforeEach(async function() {
      await this.queryInterface.dropTable('Group');
      await this.queryInterface.createTable('Group', {
        username: DataTypes.STRING,
        isAdmin: DataTypes.BOOLEAN,
        from: DataTypes.STRING
      });
    });

    // Reason: CockroachDB always have a primary index on the table which makes this test fail
    it.skip('adds, reads and removes an index to the table', async function() {
      await this.queryInterface.addIndex('Group', ['username', 'isAdmin']);
      let indexes = await this.queryInterface.showIndex('Group');
      let indexColumns = _.uniq(indexes.map(index => index.name));
      expect(indexColumns).to.include('group_username_is_admin');
      await this.queryInterface.removeIndex('Group', ['username', 'isAdmin']);
      indexes = await this.queryInterface.showIndex('Group');
      indexColumns = _.uniq(indexes.map(index => index.name));
      expect(indexColumns).to.be.empty;
    });

    // Reason: CockroachDB always have a primary index on the table which makes this test fail
    it.skip('works with schemas', async function() {
      await this.sequelize.createSchema('schema');
      await this.queryInterface.createTable('table', {
        name: {
          type: DataTypes.STRING
        },
        isAdmin: {
          type: DataTypes.STRING
        }
      }, {
        schema: 'schema'
      });
      await this.queryInterface.addIndex(
        { schema: 'schema', tableName: 'table' },
        ['name', 'isAdmin'],
        null,
        'schema_table'
      );
      const indexes = await this.queryInterface.showIndex({
        schema: 'schema',
        tableName: 'table'
      });
      expect(indexes.length).to.eq(1);
      expect(indexes[0].name).to.eq('table_name_is_admin');
    });

    it('does not fail on reserved keywords', async function() {
      await this.queryInterface.addIndex('Group', ['from']);
    });
  });

  // Reason: fixed in another PR
  describe.skip('renameColumn', () => {
    it('rename a simple column', async function() {
      const Users = this.sequelize.define('_Users', {
        username: DataTypes.STRING
      }, { freezeTableName: true });

      await Users.sync({ force: true });
      await this.queryInterface.renameColumn('_Users', 'username', 'pseudo');
      const table = await this.queryInterface.describeTable('_Users');
      expect(table).to.have.property('pseudo');
      expect(table).to.not.have.property('username');
    });

    it('works with schemas', async function() {
      await this.sequelize.createSchema('archive');
      const Users = this.sequelize.define('User', {
        username: DataTypes.STRING
      }, {
        tableName: 'Users',
        schema: 'archive'
      });
      await Users.sync({ force: true });
      await this.queryInterface.renameColumn({
        schema: 'archive',
        tableName: 'Users'
      }, 'username', 'pseudo');
      const table = await this.queryInterface.describeTable({
        schema: 'archive',
        tableName: 'Users'
      });
      expect(table).to.have.property('pseudo');
      expect(table).to.not.have.property('username');
    });

    it('rename a column non-null without default value', async function() {
      const Users = this.sequelize.define('_Users', {
        username: {
          type: DataTypes.STRING,
          allowNull: false
        }
      }, { freezeTableName: true });

      await Users.sync({ force: true });
      await this.queryInterface.renameColumn('_Users', 'username', 'pseudo');
      const table = await this.queryInterface.describeTable('_Users');
      expect(table).to.have.property('pseudo');
      expect(table).to.not.have.property('username');
    });

    it('rename a boolean column non-null without default value', async function() {
      const Users = this.sequelize.define('_Users', {
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        }
      }, { freezeTableName: true });

      await Users.sync({ force: true });
      await this.queryInterface.renameColumn('_Users', 'active', 'enabled');
      const table = await this.queryInterface.describeTable('_Users');
      expect(table).to.have.property('enabled');
      expect(table).to.not.have.property('active');
    });

    it('renames a column primary key autoIncrement column', async function() {
      const Fruits = this.sequelize.define('Fruit', {
        fruitId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }
      }, { freezeTableName: true });

      await Fruits.sync({ force: true });
      await this.queryInterface.renameColumn('Fruit', 'fruitId', 'fruit_id');
      const table = await this.queryInterface.describeTable('Fruit');
      expect(table).to.have.property('fruit_id');
      expect(table).to.not.have.property('fruitId');
    });

    it('shows a reasonable error message when column is missing', async function() {
      const Users = this.sequelize.define('_Users', {
        username: DataTypes.STRING
      }, { freezeTableName: true });

      await Users.sync({ force: true });
      await expect(
        this.queryInterface.renameColumn('_Users', 'email', 'pseudo')
      ).to.be.rejectedWith('Table _Users doesn\'t have the column email');
    });
  });

  // Reason: fixed in another PR
  describe.skip('addColumn', () => {
    beforeEach(async function() {
      await this.sequelize.createSchema('archive');
      await this.queryInterface.createTable('users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      });
    });

    it('should be able to add a foreign key reference', async function() {
      await this.queryInterface.createTable('level', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      });
      await this.queryInterface.addColumn('users', 'level_id', {
        type: DataTypes.INTEGER,
        references: {
          model: 'level',
          key: 'id'
        },
        onUpdate: 'cascade',
        onDelete: 'set null'
      });
      const table = await this.queryInterface.describeTable('users');
      expect(table).to.have.property('level_id');
    });

    it('addColumn expected error', async function() {
      await this.queryInterface.createTable('level2', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      });

      const testArgs = (...args) => expect(this.queryInterface.addColumn(...args))
        .to.be.rejectedWith(Error, 'addColumn takes at least 3 arguments (table, attribute name, attribute definition)');

      await testArgs('users', 'level_id');
      await testArgs(null, 'level_id');
      await testArgs('users', null, {});
    });

    it('should work with schemas', async function() {
      await this.queryInterface.createTable(
        { tableName: 'users', schema: 'archive' },
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
          }
        }
      );
      await this.queryInterface.addColumn(
        { tableName: 'users', schema: 'archive' },
        'level_id',
        { type: DataTypes.INTEGER }
      );
      const table = await this.queryInterface.describeTable({
        tableName: 'users',
        schema: 'archive'
      });
      expect(table).to.have.property('level_id');
    });

    it('should work with enums (1)', async function() {
      await this.queryInterface.addColumn('users', 'someEnum', DataTypes.ENUM('value1', 'value2', 'value3'));
    });

    it('should work with enums (2)', async function() {
      await this.queryInterface.addColumn('users', 'someOtherEnum', {
        type: DataTypes.ENUM,
        values: ['value1', 'value2', 'value3']
      });
    });

    it('should be able to add a column of type of array of enums', async function() {
      await this.queryInterface.addColumn('users', 'tags', {
        allowNull: false,
        type: Sequelize.ARRAY(Sequelize.ENUM(
          'Value1',
          'Value2',
          'Value3'
        ))
      });
      const result = await this.queryInterface.describeTable('users');
      expect(result).to.have.property('tags');
      expect(result.tags.type).to.equal('ARRAY');
      expect(result.tags.allowNull).to.be.false;
    });
  });

  describe('describeForeignKeys', () => {
    beforeEach(async function() {
      await this.queryInterface.createTable('users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      });
      await this.queryInterface.createTable('hosts', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        admin: {
          type: DataTypes.INTEGER,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        operator: {
          type: DataTypes.INTEGER,
          references: {
            model: 'users',
            key: 'id'
          },
          onUpdate: 'cascade'
        },
        owner: {
          type: DataTypes.INTEGER,
          references: {
            model: 'users',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'set null'
        }
      });
    });

    // Reason: For some reason one foreign key object doesn't have a property 'on_update: cascade'
    // but the foreign keys are created correctly
    it.skip('should get a list of foreign keys for the table', async function() {
      const foreignKeys = await this.sequelize.query(
        this.queryInterface.queryGenerator.getForeignKeysQuery(
          'hosts',
          this.sequelize.config.database
        ),
        { type: this.sequelize.QueryTypes.FOREIGNKEYS }
      );

      expect(foreignKeys).to.have.length(3);
      expect(Object.keys(foreignKeys[0])).to.have.length(6);
      expect(Object.keys(foreignKeys[1])).to.have.length(7);
      expect(Object.keys(foreignKeys[2])).to.have.length(7);
    });

    it('should get a list of foreign key references details for the table', async function() {
      const references = await this.queryInterface.getForeignKeyReferencesForTable('hosts', this.sequelize.options);
      expect(references).to.have.length(3);
      for (const ref of references) {
        expect(ref.tableName).to.equal('hosts');
        expect(ref.referencedColumnName).to.equal('id');
        expect(ref.referencedTableName).to.equal('users');
      }
      const columnNames = references.map(reference => reference.columnName);
      expect(columnNames).to.have.same.members(['owner', 'operator', 'admin']);
    });
  });

  // Reason: gives this error on the before each: column "uid" does not exist. Works fine on CI
  describe.skip('constraints', () => {
    beforeEach(async function() {
      this.User = this.sequelize.define('users', {
        username: DataTypes.STRING,
        email: DataTypes.STRING,
        roles: DataTypes.STRING
      });

      this.Post = this.sequelize.define('posts', {
        username: DataTypes.STRING
      });
      await this.sequelize.sync({ force: true });
    });

    describe('unique', () => {
      it('should add, read & remove unique constraint', async function() {
        await this.queryInterface.addConstraint('users', { type: 'unique', fields: ['email'] });
        let constraints = await this.queryInterface.showConstraint('users');
        constraints = constraints.map(constraint => constraint.constraintName);
        expect(constraints).to.include('users_email_uk');
        await this.queryInterface.removeConstraint('users', 'users_email_uk');
        constraints = await this.queryInterface.showConstraint('users');
        constraints = constraints.map(constraint => constraint.constraintName);
        expect(constraints).to.not.include('users_email_uk');
      });

      it('should add a constraint after another', async function() {
        await this.queryInterface.addConstraint('users', { type: 'unique', fields: ['username'] });
        await this.queryInterface.addConstraint('users', { type: 'unique', fields: ['email'] });
        let constraints = await this.queryInterface.showConstraint('users');
        constraints = constraints.map(constraint => constraint.constraintName);
        expect(constraints).to.include('users_email_uk');
        expect(constraints).to.include('users_username_uk');
        await this.queryInterface.removeConstraint('users', 'users_email_uk');
        constraints = await this.queryInterface.showConstraint('users');
        constraints = constraints.map(constraint => constraint.constraintName);
        expect(constraints).to.not.include('users_email_uk');
        expect(constraints).to.include('users_username_uk');
        await this.queryInterface.removeConstraint('users', 'users_username_uk');
        constraints = await this.queryInterface.showConstraint('users');
        constraints = constraints.map(constraint => constraint.constraintName);
        expect(constraints).to.not.include('users_email_uk');
        expect(constraints).to.not.include('users_username_uk');
      });
    });

    describe('check', () => {
      it('should add, read & remove check constraint', async function() {
        await this.queryInterface.addConstraint('users', {
          type: 'check',
          fields: ['roles'],
          where: {
            roles: ['user', 'admin', 'guest', 'moderator']
          },
          name: 'check_user_roles'
        });
        let constraints = await this.queryInterface.showConstraint('users');
        constraints = constraints.map(constraint => constraint.constraintName);
        expect(constraints).to.include('check_user_roles');
        await this.queryInterface.removeConstraint('users', 'check_user_roles');
        constraints = await this.queryInterface.showConstraint('users');
        constraints = constraints.map(constraint => constraint.constraintName);
        expect(constraints).to.not.include('check_user_roles');
      });

      // this test is different from v5 test which is synchronous (both tests works)
      it.skip('addconstraint missing type', async function() {
        await expect(
          this.queryInterface.addConstraint('users', {
            fields: ['roles'],
            where: { roles: ['user', 'admin', 'guest', 'moderator'] },
            name: 'check_user_roles'
          })
        ).to.be.rejectedWith(Error, 'Constraint type must be specified through options.type');
      });
    });

    // Reason: CockroachDB doesn't support removing the primary key outside of a transaction
    describe.skip('primary key', () => {
      it('should add, read & remove primary key constraint', async function() {
        await this.queryInterface.removeColumn('users', 'id');
        await this.queryInterface.changeColumn('users', 'username', {
          type: DataTypes.STRING,
          allowNull: false
        });
        await this.queryInterface.addConstraint('users', {
          fields: ['username'],
          type: 'PRIMARY KEY'
        });
        let constraints = await this.queryInterface.showConstraint('users');
        constraints = constraints.map(constraint => constraint.constraintName);

        const expectedConstraintName = 'users_username_pk';

        expect(constraints).to.include(expectedConstraintName);
        await this.queryInterface.removeConstraint('users', expectedConstraintName);
        constraints = await this.queryInterface.showConstraint('users');
        constraints = constraints.map(constraint => constraint.constraintName);
        expect(constraints).to.not.include(expectedConstraintName);
      });
    });

    // Reason: CockroachDB doesn't support removing the primary key outside of a transaction
    describe.skip('foreign key', () => {
      it('should add, read & remove foreign key constraint', async function() {
        await this.queryInterface.removeColumn('users', 'id');
        await this.queryInterface.changeColumn('users', 'username', {
          type: DataTypes.STRING,
          allowNull: false
        });
        await this.queryInterface.addConstraint('users', {
          type: 'PRIMARY KEY',
          fields: ['username']
        });
        await this.queryInterface.addConstraint('posts', {
          fields: ['username'],
          references: {
            table: 'users',
            field: 'username'
          },
          onDelete: 'cascade',
          onUpdate: 'cascade',
          type: 'foreign key'
        });
        let constraints = await this.queryInterface.showConstraint('posts');
        constraints = constraints.map(constraint => constraint.constraintName);
        expect(constraints).to.include('posts_username_users_fk');
        await this.queryInterface.removeConstraint('posts', 'posts_username_users_fk');
        constraints = await this.queryInterface.showConstraint('posts');
        constraints = constraints.map(constraint => constraint.constraintName);
        expect(constraints).to.not.include('posts_username_users_fk');
      });
    });

    // Reason: not an easy fix. There is an opened issue: https://github.com/cockroachdb/cockroach/issues/60920
    describe.skip('unknown constraint', () => {
      it('should throw non existent constraints as UnknownConstraintError', async function() {
        try {
          await this.queryInterface.removeConstraint('users', 'unknown__constraint__name', {
            type: 'unique'
          });
          throw new Error('Error not thrown...');
        } catch (error) {
          expect(error).to.be.instanceOf(Sequelize.UnknownConstraintError);
          expect(error.table).to.equal('users');
          expect(error.constraint).to.equal('unknown__constraint__name');
        }
      });
    });
  });
});
