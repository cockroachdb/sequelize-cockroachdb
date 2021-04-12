require('./helper');

const { expect } = require('chai');
const { Sequelize, DataTypes } = require('../source');

describe('Model', () => {
  beforeEach(async function() {
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
    it.skip('supports transactions', async function() {
      const User = this.sequelize.define('User', {
        username: DataTypes.STRING
      });
      await User.sync({ force: true });
      const transaction = await this.sequelize.transaction();
      await User.bulkCreate([{ username: 'foo' }, { username: 'bar' }], { transaction });
      const count1 = await User.count();
      const count2 = await User.count({ transaction });
      expect(count1).to.equal(0);
      expect(count2).to.equal(2);
      await transaction.rollback();
    });

    // Reason: CRDB does not grant autoIncrement to be sequential and usually does not gives it
    // small numbers like PG does. Reimplementing the test to check if it is incremental below.
    describe('return values', () => {
      it.skip('should make the auto incremented values available on the returned instances', async function() {
        const User = this.sequelize.define('user', {});

        await User
          .sync({ force: true });

        const users0 = await User.bulkCreate([
          {},
          {},
          {}
        ], {
          returning: true
        });

        const actualUsers0 = await User.findAll({ order: ['id'] });
        const [users, actualUsers] = [users0, actualUsers0];
        expect(users.length).to.eql(actualUsers.length);
        users.forEach((user, i) => {
          expect(user.get('id')).to.be.ok;
          expect(user.get('id')).to.equal(actualUsers[i].get('id'))
            .and.to.equal(i + 1);
        });
      });
      it('should make the auto incremented values available on the returned instances', async function() {
        const User = this.sequelize.define('user', {});

        await User.sync({ force: true });

        const users = await User.bulkCreate([{}, {}, {}], {
          returning: true
        });

        const actualUsers = await User.findAll({ order: ['id'] });

        const usersIds = users.map(user => user.get('id'));
        const actualUserIds = actualUsers.map(user => user.get('id'));
        const orderedUserIds = usersIds.sort((a, b) => a - b);

        users.forEach(user => expect(user.get('id')).to.be.ok);
        expect(usersIds).to.eql(actualUserIds);
        expect(usersIds).to.eql(orderedUserIds);
      });

      // Reason: CRDB does not grant autoIncrement to be sequential and usually does not gives it
      // small numbers like PG does. Reimplementing the test to check if it is incremental below.
      it.skip('should make the auto incremented values available on the returned instances with custom fields', async function() {
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
          expect(user.get('maId')).to.equal(actualUsers[i].get('maId'))
          .and.to.equal(i + 1);
        });
      });
      it('should make the auto incremented values available on the returned instances with custom fields', async function() {
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
      // Reason: CRDB does not grant autoIncrement to be sequential and usually does not gives it
      // small numbers like PG does. Reimplementing the test to check if it is incremental below.
      it.skip('should return auto increment primary key values', async function() {
        const Maya = this.sequelize.define('Maya', {});

        const M1 = {};
        const M2 = {};

        await Maya.sync({ force: true });
        const ms = await Maya.bulkCreate([M1, M2], { returning: true });
        expect(ms[0].id).to.be.eql(1);
        expect(ms[1].id).to.be.eql(2);
      });
      it('should return auto increment primary key values', async function() {
        const Maya = this.sequelize.define('Maya', {});

        const M1 = {};
        const M2 = {};

        await Maya.sync({ force: true });
        const ms = await Maya.bulkCreate([M1, M2], { returning: true });
        
        expect(ms[0].id < ms[1].id).to.be.true;
      });
    });
  });
});
