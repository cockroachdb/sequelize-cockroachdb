'use strict';

require('./helper');

const { expect } = require('chai');
const sinon = require('sinon');
const { Sequelize, DataTypes } = require('../source');

const dialect = 'postgres';
const Op = Sequelize.Op;
const _ = require('lodash');

describe('Model', () => {
  beforeEach(async function() {
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      secretValue: DataTypes.STRING,
      data: DataTypes.STRING,
      intVal: DataTypes.INTEGER,
      theDate: DataTypes.DATE,
      aBool: DataTypes.BOOLEAN,
      uniqueName: { type: DataTypes.STRING, unique: true }
    });
    this.Account = this.sequelize.define('Account', {
      accountName: DataTypes.STRING
    });
    this.Student = this.sequelize.define('Student', {
      no: { type: DataTypes.INTEGER, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false }
    });

    await this.sequelize.sync({ force: true });
  });

  describe('findOrCreate', () => {
    // Reason: CockroachDB guarantees that while a transaction is pending, it is isolated from other concurrent transactions with serializable isolation.
    // https://www.cockroachlabs.com/docs/stable/transactions.html
    it.skip('supports transactions', async function() {
      const t = await this.sequelize.transaction();

      await this.User.findOrCreate({
        where: {
          username: 'Username'
        },
        defaults: {
          data: 'some data'
        },
        transaction: t
      });

      const count = await this.User.count();
      expect(count).to.equal(0);
      await t.commit();
      const count0 = await this.User.count();
      expect(count0).to.equal(1);
    });

    // Reason: CRDB has to return a Details field at bytes stream. Since it doesn't, it does not
    // generate the 'error.errors' array. 
    // https://github.com/cockroachdb/cockroach/issues/63332
    it.skip('should error correctly when defaults contain a unique key and the where clause is complex', async function() {
      const User = this.sequelize.define('user', {
        objectId: {
          type: DataTypes.STRING,
          unique: true
        },
        username: {
          type: DataTypes.STRING,
          unique: true
        }
      });

      await User.sync({ force: true });
      await User.create({ username: 'gottlieb' });

      try {
        await User.findOrCreate({
          where: {
            [Op.or]: [{
              objectId: 'asdasdasd1'
            }, {
              objectId: 'asdasdasd2'
            }]
          },
          defaults: {
            username: 'gottlieb'
          }
        });
      } catch (error) {
        expect(error).to.be.instanceof(Sequelize.UniqueConstraintError);
        expect(error.errors[0].path).to.be.a('string', 'username');
      }
    });

    it('should not deadlock with concurrency duplicate entries and no outer transaction', async function() {
      const User = this.sequelize.define('User', {
        email: {
          type: DataTypes.STRING,
          unique: 'company_user_email'
        },
        companyId: {
          type: DataTypes.INTEGER,
          unique: 'company_user_email'
        }
      });

      await User.sync({ force: true });

      await Promise.all(_.range(50).map(() => {
        return User.findOrCreate({
          where: {
            email: 'unique.email.1@sequelizejs.com',
            companyId: 2
          }
        });
      }));
    });

    // Reason: Transaction stuff. Usually crashes Sequelize and times out tests by 60 seconds.    
    describe.skip('several concurrent calls', () => {
      it('works with a transaction', async function() {
        const transaction = await this.sequelize.transaction();

        const [first, second] = await Promise.all([
          this.User.findOrCreate({ where: { uniqueName: 'winner' }, transaction }),
          this.User.findOrCreate({ where: { uniqueName: 'winner' }, transaction })
        ]);

        const firstInstance = first[0],
          firstCreated = first[1],
          secondInstance = second[0],
          secondCreated = second[1];

        // Depending on execution order and MAGIC either the first OR the second call should return true
        expect(firstCreated ? !secondCreated : secondCreated).to.be.ok; // XOR

        expect(firstInstance).to.be.ok;
        expect(secondInstance).to.be.ok;

        expect(firstInstance.id).to.equal(secondInstance.id);

        await transaction.commit();
      });

      it('should not fail silently with concurrency higher than pool, a unique constraint and a create hook resulting in mismatched values', async function() {
        const User = this.sequelize.define('user', {
          username: {
            type: DataTypes.STRING,
            unique: true,
            field: 'user_name'
          }
        });

        User.beforeCreate(instance => {
          instance.set('username', instance.get('username').trim());
        });

        const spy = sinon.spy();

        const names = [
          'mick ',
          'mick ',
          'mick ',
          'mick ',
          'mick ',
          'mick ',
          'mick '
        ];

        await User.sync({ force: true });

        await Promise.all(
          names.map(async username => {
            try {
              return await User.findOrCreate({ where: { username } });
            } catch (err) {
              spy();
              expect(err.message).to.equal('user#findOrCreate: value used for username was not equal for both the find and the create calls, \'mick \' vs \'mick\'');
            }
          })
        );

        expect(spy).to.have.been.called;
      });

      it('should error correctly when defaults contain a unique key without a transaction', async function() {
        const User = this.sequelize.define('user', {
          objectId: {
            type: DataTypes.STRING,
            unique: true
          },
          username: {
            type: DataTypes.STRING,
            unique: true
          }
        });

        await User.sync({ force: true });

        await User.create({
          username: 'gottlieb'
        });

        return Promise.all([(async () => {
          try {
            await User.findOrCreate({
              where: {
                objectId: 'asdasdasd'
              },
              defaults: {
                username: 'gottlieb'
              }
            });

            throw new Error('I should have ben rejected');
          } catch (err) {
            expect(err instanceof Sequelize.UniqueConstraintError).to.be.ok;
            expect(err.fields).to.be.ok;
          }
        })(), (async () => {
          try {
            await User.findOrCreate({
              where: {
                objectId: 'asdasdasd'
              },
              defaults: {
                username: 'gottlieb'
              }
            });

            throw new Error('I should have ben rejected');
          } catch (err) {
            expect(err instanceof Sequelize.UniqueConstraintError).to.be.ok;
            expect(err.fields).to.be.ok;
          }
        })()]);
      });

      // Creating two concurrent transactions and selecting / inserting from the same table throws sqlite off
      it('works without a transaction', async function() {
        const [first, second] = await Promise.all([
          this.User.findOrCreate({ where: { uniqueName: 'winner' } }),
          this.User.findOrCreate({ where: { uniqueName: 'winner' } })
        ]);

        const firstInstance = first[0],
          firstCreated = first[1],
          secondInstance = second[0],
          secondCreated = second[1];

        // Depending on execution order and MAGIC either the first OR the second call should return true
        expect(firstCreated ? !secondCreated : secondCreated).to.be.ok; // XOR

        expect(firstInstance).to.be.ok;
        expect(secondInstance).to.be.ok;

        expect(firstInstance.id).to.equal(secondInstance.id);
      });
    });
  });

  describe('findCreateFind', () => {
    it('should work with multiple concurrent calls', async function() {
      const [first, second, third] = await Promise.all([
        this.User.findOrCreate({ where: { uniqueName: 'winner' } }),
        this.User.findOrCreate({ where: { uniqueName: 'winner' } }),
        this.User.findOrCreate({ where: { uniqueName: 'winner' } })
      ]);

      const firstInstance = first[0],
        firstCreated = first[1],
        secondInstance = second[0],
        secondCreated = second[1],
        thirdInstance = third[0],
        thirdCreated = third[1];

      expect([firstCreated, secondCreated, thirdCreated].filter(value => {
        return value;
      }).length).to.equal(1);

      expect(firstInstance).to.be.ok;
      expect(secondInstance).to.be.ok;
      expect(thirdInstance).to.be.ok;

      expect(firstInstance.id).to.equal(secondInstance.id);
      expect(secondInstance.id).to.equal(thirdInstance.id);
    });
  });

  describe('create', () => {
    // Reason: CockroachDB guarantees that while a transaction is pending, it is isolated from other concurrent transactions with serializable isolation.
    // https://www.cockroachlabs.com/docs/stable/transactions.html
    it.skip('supports transactions', async function() {
      const t = await this.sequelize.transaction();
      await this.User.create({ username: 'user' }, { transaction: t });
      const count = await this.User.count();
      expect(count).to.equal(0);
      await t.commit();
      const count0 = await this.User.count();
      expect(count0).to.equal(1);
    });

    // Reason: the ids are Serial on CRDB by default. Thus, it will be a BigInt instead of "1".
    describe.skip('return values', () => {
      it('should make the autoincremented values available on the returned instances', async function() {
        const User = this.sequelize.define('user', {});

        await User.sync({ force: true });
        const user = await User.create({}, { returning: true });
        expect(user.get('id')).to.be.ok;
        expect(user.get('id')).to.equal(1);
      });

      it('should make the autoincremented values available on the returned instances with custom fields', async function() {
        const User = this.sequelize.define('user', {
          maId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            field: 'yo_id'
          }
        });

        await User.sync({ force: true });
        const user = await User.create({}, { returning: true });
        expect(user.get('maId')).to.be.ok;
        expect(user.get('maId')).to.equal(1);
      });
    });

    // Reason: CRDB does not use uuid-ossp. It uses gen_random_uuid() function instead.
    // Docs: https://www.cockroachlabs.com/docs/stable/functions-and-operators.html#id-generation-functions
    // Closed Issue: https://github.com/cockroachdb/cockroach/issues/40586 
    // Reimplemented the test the right way below
    it.skip('is possible to use functions as default values', async function() {
      let userWithDefaults;

      if (dialect.startsWith('postgres')) {
        await this.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        userWithDefaults = this.sequelize.define('userWithDefaults', {
          uuid: {
            type: 'UUID',
            defaultValue: this.sequelize.fn('uuid_generate_v4')
          }
        });

        await userWithDefaults.sync({ force: true });
        const user = await userWithDefaults.create({});
        // uuid validation regex taken from http://stackoverflow.com/a/13653180/800016
        expect(user.uuid).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        return;
      }
    });
    it('is possible to use functions as default values', async function() {
      let userWithDefaults;

      if (dialect.startsWith('postgres')) {
        userWithDefaults = this.sequelize.define('userWithDefaults', {
          uuid: {
            type: 'UUID',
            defaultValue: this.sequelize.fn('gen_random_uuid')
          }
        });

        await userWithDefaults.sync({ force: true });
        const user = await userWithDefaults.create({});
        // uuid validation regex taken from http://stackoverflow.com/a/13653180/800016
        expect(user.uuid).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        return;
      }
    });

    // Reason: CockroachDB does not yet support CITEXT
    // Seen here: https://github.com/cockroachdb/cockroach/issues/22463
    it.skip("doesn't allow case-insensitive duplicated records using CITEXT", async function() {
      const User = this.sequelize.define('UserWithUniqueCITEXT', {
        username: { type: Sequelize.CITEXT, unique: true }
      });

      try {
        await User.sync({ force: true });
        await User.create({ username: 'foo' });
        await User.create({ username: 'fOO' });
      } catch (err) {
        if (!(err instanceof Sequelize.UniqueConstraintError)) throw err;
        expect(err).to.be.ok;
      }
    });

    // Reason: CockroachDB does not yet support TSVECTOR
    // Seen here: https://github.com/cockroachdb/cockroach/issues/41288
    it.skip('allows the creation of a TSVECTOR field', async function() {
      const User = this.sequelize.define('UserWithTSVECTOR', {
        name: Sequelize.TSVECTOR
      });

      await User.sync({ force: true });
      await User.create({ name: 'John Doe' });
    });

    // Reason: CockroachDB does not yet support TSVECTOR
    // Seen here: https://github.com/cockroachdb/cockroach/issues/41288
    it.skip('TSVECTOR only allow string', async function() {
      const User = this.sequelize.define('UserWithTSVECTOR', {
        username: { type: Sequelize.TSVECTOR }
      });

      try {
        await User.sync({ force: true });
        await User.create({ username: 42 });
      } catch (err) {
        if (!(err instanceof Sequelize.ValidationError)) throw err;
        expect(err).to.be.ok;
      }
    });

    // Reason: CoackroachDB does not support 'lower' function for INDEX
    // Seen here: https://github.com/cockroachdb/cockroach/issues/9682?version=v20.2
    it.skip("doesn't allow duplicated records with unique function based indexes", async function() {
      const User = this.sequelize.define('UserWithUniqueUsernameFunctionIndex', {
        username: Sequelize.STRING,
        email: { type: Sequelize.STRING, unique: true }
      });

      try {
        await User.sync({ force: true });
        const tableName = User.getTableName();
        await this.sequelize.query(`CREATE UNIQUE INDEX lower_case_username ON "${tableName}" ((lower(username)))`);
        await User.create({ username: 'foo' });
        await User.create({ username: 'foo' });
      } catch (err) {
        if (!(err instanceof Sequelize.UniqueConstraintError)) throw err;
        expect(err).to.be.ok;
      }
    });

    // Reason: CRDB does not grant autoIncrement to be sequential and usually does not gives it
    // small numbers like PG does. Reimplementing the test to check if it is incremental below.
    it.skip('sets auto increment fields', async function() {
      const User = this.sequelize.define('UserWithAutoIncrementField', {
        userid: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false }
      });

      await User.sync({ force: true });
      const user = await User.create({});
      expect(user.userid).to.equal(1);
      const user0 = await User.create({});
      expect(user0.userid).to.equal(2);
    });
    it('sets auto increment fields', async function() {
      const User = this.sequelize.define('UserWithAutoIncrementField', {
        userid: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false }
      });

      await User.sync({ force: true });
      const user1 = await User.create({});
      const user2 = await User.create({});

      expect(user2.userid > user1.userid).to.be.true;
    });
  });

  // Reason: CRDB works with Serial as Primary Key by default. This expects the id
  // to be 1, when it is actually a BigInt. 
  it.skip('should return autoIncrement primary key (create)', async function() {
    const Maya = this.sequelize.define('Maya', {});

    const M1 = {};

    await Maya.sync({ force: true });
    const m = await Maya.create(M1, { returning: true });
    expect(m.id).to.be.eql(1);
  });
});