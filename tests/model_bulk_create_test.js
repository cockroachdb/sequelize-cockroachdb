require('./helper');

const { expect } = require('chai');
const { DataTypes } = require('../source');

describe('Model', () => {
  beforeEach(async function () {
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      secretValue: {
        type: DataTypes.STRING,
        field: 'secret_value'
      },
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
    this.Car = this.sequelize.define('Car', {
      plateNumber: {
        type: DataTypes.STRING,
        primaryKey: true,
        field: 'plate_number'
      },
      color: {
        type: DataTypes.TEXT
      }
    });

    await this.sequelize.sync({ force: true });
  });

  describe('bulkCreate', () => {
    it.skip('supports transactions', async function () {
      const User = this.sequelize.define('User', {
        username: DataTypes.STRING
      });
      await User.sync({ force: true });
      const transaction = await this.sequelize.transaction();
      await User.bulkCreate([{ username: 'foo' }, { username: 'bar' }], {
        transaction
      });
      const count1 = await User.count();
      const count2 = await User.count({ transaction });
      expect(count1).to.equal(0);
      expect(count2).to.equal(2);
      await transaction.rollback();
    });

    // Reason: CRDB does not guarantee autoIncrement to be sequential.
    // Reimplementing the test to check if it is incremental below.
    describe('return values', () => {
      it.skip('should make the auto incremented values available on the returned instances', async function () {
        const User = this.sequelize.define('user', {});

        await User.sync({ force: true });

        const users0 = await User.bulkCreate([{}, {}, {}], { returning: true });

        const actualUsers0 = await User.findAll({ order: ['id'] });
        const [users, actualUsers] = [users0, actualUsers0];
        expect(users.length).to.eql(actualUsers.length);
        users.forEach((user, i) => {
          expect(user.get('id')).to.be.ok;
          expect(user.get('id'))
            .to.equal(actualUsers[i].get('id'))
            .and.to.equal(i + 1);
        });
      });
      it('should make the auto incremented values available on the returned instances', async function () {
        const User = this.sequelize.define('user', {});

        await User.sync({ force: true });

        const users = await User.bulkCreate([{}, {}, {}], { returning: true });

        const actualUsers = await User.findAll({ order: ['id'] });

        const usersIds = users.map(user => user.get('id'));
        const actualUserIds = actualUsers.map(user => user.get('id'));
        const orderedUserIds = usersIds.sort((a, b) => a - b);

        users.forEach(user => expect(user.get('id')).to.be.ok);
        expect(usersIds).to.eql(actualUserIds);
        expect(usersIds).to.eql(orderedUserIds);
      });

      // Reason: CRDB does not guarantee autoIncrement to be sequential.
      // Reimplementing the test to check if it is incremental below.
      it.skip('should make the auto incremented values available on the returned instances with custom fields', async function () {
        const User = this.sequelize.define('user', {
          maId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            field: 'yo_id'
          }
        });

        await User.sync({ force: true });

        const users = await User.bulkCreate([{}, {}, {}], { returning: true });

        const actualUsers = await User.findAll({ order: ['maId'] });

        expect(users.length).to.eql(actualUsers.length);
        users.forEach((user, i) => {
          expect(user.get('maId')).to.be.ok;
          expect(user.get('maId'))
            .to.equal(actualUsers[i].get('maId'))
            .and.to.equal(i + 1);
        });
      });
      it('should make the auto incremented values available on the returned instances with custom fields', async function () {
        const User = this.sequelize.define('user', {
          maId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            field: 'yo_id'
          }
        });

        await User.sync({ force: true });

        const users = await User.bulkCreate([{}, {}, {}], { returning: true });

        const actualUsers = await User.findAll({ order: ['maId'] });

        const usersIds = users.map(user => user.get('maId'));
        const actualUserIds = actualUsers.map(user => user.get('maId'));
        const orderedUserIds = usersIds.sort((a, b) => a - b);

        users.forEach(user => expect(user.get('maId')).to.be.ok);
        expect(usersIds).to.eql(actualUserIds);
        expect(usersIds).to.eql(orderedUserIds);
      });
    });

    describe('handles auto increment values', () => {
      // Reason: CRDB does not guarantee autoIncrement to be sequential.
      // Reimplementing the test to check if it is incremental below.
      it.skip('should return auto increment primary key values', async function () {
        const Maya = this.sequelize.define('Maya', {});

        const M1 = {};
        const M2 = {};

        await Maya.sync({ force: true });
        const ms = await Maya.bulkCreate([M1, M2], { returning: true });
        expect(ms[0].id).to.be.eql(1);
        expect(ms[1].id).to.be.eql(2);
      });
      it('should return auto increment primary key values', async function () {
        const Maya = this.sequelize.define('Maya', {});

        const M1 = {};
        const M2 = {};

        await Maya.sync({ force: true });
        const ms = await Maya.bulkCreate([M1, M2], { returning: true });

        expect(ms[0].id < ms[1].id).to.be.true;
      });
    });

    // CockroachDB does not return the rows of INSERT ... ON CONFLICT DO UPDATE
    // ... RETURNING in the order of the VALUES list; rows that were updated
    // can come back before rows that were inserted. Sequelize assigns the
    // returned rows to instances by position, so the adapter must reorder them.
    describe('updateOnDuplicate return values', () => {
      // Checks that each returned instance matches both its input and the
      // row that is stored in the database under the instance's primary key.
      async function expectInstancesMatchRows(Model, input, results, fields) {
        expect(results).to.have.length(input.length);
        const pk = Model.primaryKeyAttribute;
        const rows = await Model.findAll({ paranoid: false });
        const rowsByPk = new Map(rows.map(row => [String(row[pk]), row]));
        results.forEach((result, i) => {
          for (const field of fields) {
            expect(result[field]).to.eql(input[i][field]);
          }
          const row = rowsByPk.get(String(result[pk]));
          expect(row, `row for ${pk}=${result[pk]}`).to.be.ok;
          for (const field of fields) {
            expect(row[field]).to.eql(result[field]);
          }
        });
      }

      it('should match rows to instances when the primary key conflicts', async function () {
        await this.Student.bulkCreate([
          { no: 2, name: 'old 2' },
          { no: 4, name: 'old 4' }
        ]);

        const input = [1, 2, 3, 4, 5, 6].map(no => ({ no, name: `new ${no}` }));
        const results = await this.Student.bulkCreate(input, {
          updateOnDuplicate: ['name']
        });

        await expectInstancesMatchRows(this.Student, input, results, [
          'no',
          'name'
        ]);
      });

      it('should match rows to instances when a unique key conflicts', async function () {
        const existing = await this.User.bulkCreate([
          { uniqueName: 'b', username: 'old b' },
          { uniqueName: 'd', username: 'old d' }
        ]);

        const input = ['a', 'b', 'c', 'd', 'e'].map(uniqueName => ({
          uniqueName,
          username: `new ${uniqueName}`
        }));
        const results = await this.User.bulkCreate(input, {
          updateOnDuplicate: ['username']
        });

        await expectInstancesMatchRows(this.User, input, results, [
          'uniqueName',
          'username'
        ]);
        // Updated rows keep their original primary keys.
        expect(results[1].id).to.eql(existing[0].id);
        expect(results[3].id).to.eql(existing[1].id);
      });

      it('should match rows to instances when some rows omit the conflict key', async function () {
        const [existing] = await this.Account.bulkCreate([
          { accountName: 'old' }
        ]);

        const input = [
          { accountName: 'new 1' },
          { id: existing.id, accountName: 'updated' },
          { accountName: 'new 2' },
          { accountName: 'new 3' }
        ];
        const results = await this.Account.bulkCreate(input, {
          updateOnDuplicate: ['accountName']
        });

        await expectInstancesMatchRows(this.Account, input, results, [
          'accountName'
        ]);
        expect(results[1].id).to.eql(existing.id);
      });

      it('should match rows to instances with a partial unique index and conflictWhere', async function () {
        const Memberships = this.sequelize.define(
          'memberships',
          {
            user_id: DataTypes.INTEGER,
            foreign_id: DataTypes.INTEGER,
            time_deleted: DataTypes.DATE
          },
          {
            createdAt: false,
            updatedAt: false,
            deletedAt: 'time_deleted',
            indexes: [
              {
                fields: ['user_id', 'foreign_id'],
                unique: true,
                where: { time_deleted: null }
              }
            ]
          }
        );
        await Memberships.sync({ force: true });
        const options = {
          conflictWhere: { time_deleted: null },
          conflictAttributes: ['user_id', 'foreign_id'],
          updateOnDuplicate: ['user_id', 'foreign_id', 'time_deleted']
        };

        // Odd rows are soft-deleted, so they are not covered by the partial
        // unique index and will be inserted again below.
        await Memberships.bulkCreate(
          new Array(10).fill().map((_, i) => ({
            user_id: i + 1,
            foreign_id: i + 20,
            time_deleted: i % 2 ? new Date() : null
          })),
          options
        );

        const input = new Array(10).fill().map((_, i) => ({
          user_id: i + 1,
          foreign_id: i + 20,
          time_deleted: null
        }));
        const results = await Memberships.bulkCreate(input, options);

        await expectInstancesMatchRows(Memberships, input, results, [
          'user_id',
          'foreign_id',
          'time_deleted'
        ]);
        expect(await Memberships.count({ paranoid: false })).to.eq(15);
      });
    });
  });
});
