'use strict';

const { expect } = require('chai');
const { Sequelize, DataTypes } = require('../source');
const moment = require('moment');

const config = {
  rand: () => parseInt(Math.random() * 999, 10)
};

describe('Model', () => {
  beforeEach(async function() {
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      secretValue: DataTypes.STRING,
      data: DataTypes.STRING,
      intVal: DataTypes.INTEGER,
      theDate: DataTypes.DATE,
      aBool: DataTypes.BOOLEAN,
      binary: DataTypes.STRING(16, true)
    });

    await this.User.sync({ force: true });
  });

  describe.only('findAll', () => {
    it.skip('supports transactions', async function() {
      const sequelize = await Support.prepareTransactionTest(this.sequelize);
      const User = sequelize.define('User', { username: Sequelize.STRING });

      await User.sync({ force: true });
      const t = await sequelize.transaction();
      await User.create({ username: 'foo' }, { transaction: t });
      const users1 = await User.findAll({ where: { username: 'foo' } });
      const users2 = await User.findAll({ transaction: t });
      const users3 = await User.findAll({ where: { username: 'foo' }, transaction: t });
      expect(users1.length).to.equal(0);
      expect(users2.length).to.equal(1);
      expect(users3.length).to.equal(1);
      await t.rollback();
    });

    describe('special where conditions/smartWhere object', () => {
      beforeEach(async function() {
        this.buf = Buffer.alloc(16);
        this.buf.fill('\x01');

        await this.User.bulkCreate([
          { username: 'boo', intVal: 5, theDate: '2013-01-01 12:00' },
          { username: 'boo2', intVal: 10, theDate: '2013-01-10 12:00', binary: this.buf }
        ]);
      });

      it('should be able to handle false/true values through associations as well...', async function() {
        const User = this.User,
          Passports = this.sequelize.define('Passports', {
            isActive: Sequelize.BOOLEAN
          });

        User.hasMany(Passports);
        Passports.belongsTo(User);

        await User.sync({ force: true });
        await Passports.sync({ force: true });

        await User.bulkCreate([
          { username: 'boo5', aBool: false },
          { username: 'boo6', aBool: true }
        ]);

        await Passports.bulkCreate([
          { isActive: true },
          { isActive: false }
        ]);

        const user = await User.findByPk(1);
        const passport = await Passports.findByPk(1);
        await user.setPassports([passport]);
        const _user = await User.findByPk(2);
        const _passport = await Passports.findByPk(2);
        await _user.setPassports([_passport]);
        const theFalsePassport = await _user.getPassports({ where: { isActive: false } });
        const theTruePassport = await user.getPassports({ where: { isActive: true } });
        expect(theFalsePassport).to.have.length(1);
        expect(theFalsePassport[0].isActive).to.be.false;
        expect(theTruePassport).to.have.length(1);
        expect(theTruePassport[0].isActive).to.be.true;
      });

      it('should be able to handle binary values through associations as well...', async function() {
        const User = this.User;
        const Binary = this.sequelize.define('Binary', {
          id: {
            type: DataTypes.STRING(16, true),
            primaryKey: true
          }
        });

        const buf1 = this.buf;
        const buf2 = Buffer.alloc(16);
        buf2.fill('\x02');

        User.belongsTo(Binary, { foreignKey: 'binary' });

        await this.sequelize.sync({ force: true });

        await User.bulkCreate([
          { username: 'boo5', aBool: false },
          { username: 'boo6', aBool: true }
        ]);

        await Binary.bulkCreate([
          { id: buf1 },
          { id: buf2 }
        ]);

        const user = await User.findByPk(1);
        const binary = await Binary.findByPk(buf1);
        await user.setBinary(binary);
        const _user = await User.findByPk(2);
        const _binary = await Binary.findByPk(buf2);
        await _user.setBinary(_binary);
        const _binaryRetrieved = await _user.getBinary();
        const binaryRetrieved = await user.getBinary();
        expect(binaryRetrieved.id).to.have.length(16);
        expect(_binaryRetrieved.id).to.have.length(16);
        expect(binaryRetrieved.id.toString()).to.be.equal(buf1.toString());
        expect(_binaryRetrieved.id.toString()).to.be.equal(buf2.toString());
      });

      it('should be able to find multiple users with case-insensitive on CITEXT type', async function() {
        const User = this.sequelize.define('UsersWithCaseInsensitiveName', {
          username: Sequelize.CITEXT
        });

        await User.sync({ force: true });

        await User.bulkCreate([
          { username: 'lowercase' },
          { username: 'UPPERCASE' },
          { username: 'MIXEDcase' }
        ]);

        const users = await User.findAll({
          where: { username: ['LOWERCASE', 'uppercase', 'mixedCase'] },
          order: [['id', 'ASC']]
        });

        expect(users[0].username).to.equal('lowercase');
        expect(users[1].username).to.equal('UPPERCASE');
        expect(users[2].username).to.equal('MIXEDcase');
      });
    });

    describe('normal findAll', () => {
      beforeEach(async function() {
        const user = await this.User.create({ username: 'user', data: 'foobar', theDate: moment().toDate() });
        const user2 = await this.User.create({ username: 'user2', data: 'bar', theDate: moment().toDate() });
        this.users = [user].concat(user2);
      });

      it('sorts the results via id in ascending order', async function() {
        const users = await this.User.findAll();
        expect(users.length).to.equal(2);
        expect(users[0].id).to.be.below(users[1].id);
      });

      it('sorts the results via id in descending order', async function() {
        const users = await this.User.findAll({ order: [['id', 'DESC']] });
        expect(users[0].id).to.be.above(users[1].id);
      });

      it('sorts the results via a date column', async function() {
        await this.User.create({ username: 'user3', data: 'bar', theDate: moment().add(2, 'hours').toDate() });
        const users = await this.User.findAll({ order: [['theDate', 'DESC']] });
        expect(users[0].id).to.be.above(users[2].id);
      });

      it('handles offset and limit', async function() {
        await this.User.bulkCreate([{ username: 'bobby' }, { username: 'tables' }]);
        const users = await this.User.findAll({ limit: 2, offset: 2 });
        expect(users.length).to.equal(2);
        expect(users[0].id).to.equal(3);
      });

      it('should allow us to find IDs using capital letters', async function() {
        const User = this.sequelize.define(`User${config.rand()}`, {
          ID: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          Login: { type: Sequelize.STRING }
        });

        await User.sync({ force: true });
        await User.create({ Login: 'foo' });
        const user = await User.findAll({ where: { ID: 1 } });
        expect(user).to.be.instanceof(Array);
        expect(user).to.have.length(1);
      });
    });
  });
});