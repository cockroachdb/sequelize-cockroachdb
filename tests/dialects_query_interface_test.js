'use strict';

const { expect } = require('chai');
const DataTypes = require('../source');
const _ = require('lodash');

// Skip reason:
// CRDB does not have CREATE FUNCTION syntax.
describe.only('[POSTGRES Specific] QueryInterface', () => {
  beforeEach(function () {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  describe('renameFunction', () => {
    beforeEach(async function () {
      // ensure the function names we'll use don't exist before we start.
      // then setup our function to rename
      await this.queryInterface.dropFunction('rftest1', []).catch(() => {});

      await this.queryInterface.dropFunction('rftest2', []).catch(() => {});

      await this.queryInterface.createFunction(
        'rftest1',
        [],
        'varchar',
        'plpgsql',
        "return 'testreturn';",
        {}
      );
    });

    it('renames a function', async function () {
      await this.queryInterface.renameFunction('rftest1', [], 'rftest2');
      const res = await this.sequelize.query('select rftest2();', {
        type: this.sequelize.QueryTypes.SELECT
      });
      expect(res[0].rftest2).to.be.eql('testreturn');
    });
  });

  describe('createFunction', () => {
    beforeEach(async function () {
      // make sure we don't have a pre-existing function called create_job
      // this is needed to cover the edge case of afterEach not getting called because of an unexpected issue or stopage with the
      // test suite causing a failure of afterEach's cleanup to be called.
      await this.queryInterface
        .dropFunction('create_job', [{ type: 'varchar', name: 'test' }])
        // suppress errors here. if create_job doesn't exist thats ok.
        .catch(() => {});
    });

    after(async function () {
      // cleanup
      await this.queryInterface
        .dropFunction('create_job', [{ type: 'varchar', name: 'test' }])
        // suppress errors here. if create_job doesn't exist thats ok.
        .catch(() => {});
    });

    it('creates a stored procedure', async function () {
      const body = 'return test;';
      const options = {};

      // make our call to create a function
      await this.queryInterface.createFunction(
        'create_job',
        [{ type: 'varchar', name: 'test' }],
        'varchar',
        'plpgsql',
        body,
        options
      );
      // validate
      const res = await this.sequelize.query("select create_job('test');", {
        type: this.sequelize.QueryTypes.SELECT
      });
      expect(res[0].create_job).to.be.eql('test');
    });

    it('treats options as optional', async function () {
      const body = 'return test;';

      // run with null options parameter
      await this.queryInterface.createFunction(
        'create_job',
        [{ type: 'varchar', name: 'test' }],
        'varchar',
        'plpgsql',
        body,
        null
      );
      // validate
      const res = await this.sequelize.query("select create_job('test');", {
        type: this.sequelize.QueryTypes.SELECT
      });
      expect(res[0].create_job).to.be.eql('test');
    });

    it('overrides a function', async function () {
      const first_body = "return 'first';";
      const second_body = "return 'second';";

      // create function
      await this.queryInterface.createFunction(
        'create_job',
        [{ type: 'varchar', name: 'test' }],
        'varchar',
        'plpgsql',
        first_body,
        null
      );
      // override
      await this.queryInterface.createFunction(
        'create_job',
        [{ type: 'varchar', name: 'test' }],
        'varchar',
        'plpgsql',
        second_body,
        null,
        { force: true }
      );
      // validate
      const res = await this.sequelize.query("select create_job('abc');", {
        type: this.sequelize.QueryTypes.SELECT
      });
      expect(res[0].create_job).to.be.eql('second');
    });

    it('uses declared variables', async function () {
      const body = 'RETURN myVar + 1;';
      const options = {
        variables: [{ type: 'integer', name: 'myVar', default: 100 }]
      };
      await this.queryInterface.createFunction(
        'add_one',
        [],
        'integer',
        'plpgsql',
        body,
        [],
        options
      );
      const res = await this.sequelize.query('select add_one();', {
        type: this.sequelize.QueryTypes.SELECT
      });
      expect(res[0].add_one).to.be.eql(101);
    });
  });

  describe('dropFunction', () => {
    beforeEach(async function () {
      const body = 'return test;';
      const options = {};

      // make sure we have a droptest function in place.
      await this.queryInterface
        .createFunction(
          'droptest',
          [{ type: 'varchar', name: 'test' }],
          'varchar',
          'plpgsql',
          body,
          options
        )
        // suppress errors.. this could fail if the function is already there.. thats ok.
        .catch(() => {});
    });

    it('can drop a function', async function () {
      // call drop function
      await this.queryInterface.dropFunction('droptest', [
        { type: 'varchar', name: 'test' }
      ]);
      await expect(
        // now call the function we attempted to drop.. if dropFunction worked as expect it should produce an error.
        this.sequelize.query("select droptest('test');", {
          type: this.sequelize.QueryTypes.SELECT
        })
        // test that we did get the expected error indicating that droptest was properly removed.
      ).to.be.rejectedWith(/.*function droptest.* does not exist/);
    });
  });

  describe('indexes', () => {
    beforeEach(async function () {
      await this.queryInterface.dropTable('Group');

      await this.queryInterface.createTable('Group', {
        username: DataTypes.STRING,
        isAdmin: DataTypes.BOOLEAN,
        from: DataTypes.STRING
      });
    });

    it('supports newlines', async function () {
      await this.queryInterface.addIndex(
        'Group',
        [
          this.sequelize.literal(`(
            CASE "username"
              WHEN 'foo' THEN 'bar'
              ELSE 'baz'
            END
          )`)
        ],
        { name: 'group_username_case' }
      );

      const indexes = await this.queryInterface.showIndex('Group');
      const indexColumns = _.uniq(indexes.map(index => index.name));

      expect(indexColumns).to.include('group_username_case');
    });

    it('adds, reads and removes a named functional index to the table', async function () {
      await this.queryInterface.addIndex(
        'Group',
        [this.sequelize.fn('lower', this.sequelize.col('username'))],
        {
          name: 'group_username_lower'
        }
      );

      const indexes0 = await this.queryInterface.showIndex('Group');
      const indexColumns0 = _.uniq(indexes0.map(index => index.name));

      expect(indexColumns0).to.include('group_username_lower');
      await this.queryInterface.removeIndex('Group', 'group_username_lower');
      const indexes = await this.queryInterface.showIndex('Group');
      const indexColumns = _.uniq(indexes.map(index => index.name));
      expect(indexColumns).to.be.empty;
    });
  });
});
