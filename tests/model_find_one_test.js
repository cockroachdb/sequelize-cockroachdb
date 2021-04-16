'use strict';

require('./helper');

const { expect } = require('chai'),
  { Sequelize, DataTypes } = require('../source');

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
      aBool: DataTypes.BOOLEAN
    });

    await this.User.sync({ force: true });
  });

  describe('findOne', () => {
    it.skip('supports transactions', async function() {
      const User = this.sequelize.define('User', { username: Sequelize.STRING });

      await User.sync({ force: true });
      const t = await this.sequelize.transaction();
      await User.create({ username: 'foo' }, { transaction: t });

      const user1 = await User.findOne({
        where: { username: 'foo' }
      });

      const user2 = await User.findOne({
        where: { username: 'foo' },
        transaction: t
      });

      expect(user1).to.be.null;
      expect(user2).to.not.be.null;
      await t.rollback();
    });

    describe('general / basic function', () => {
      beforeEach(async function() {
        const user = await this.User.create({ username: 'barfooz' });
        this.UserPrimary = this.sequelize.define('UserPrimary', {
          specialkey: {
            type: DataTypes.STRING,
            primaryKey: true
          }
        });

        await this.UserPrimary.sync({ force: true });
        await this.UserPrimary.create({ specialkey: 'a string' });
        this.user = user;
      });

      // Edited Test
      // Reason: This test expects id to be 1. 
      // CRDB does not work with human-readable ids by default.
      it('returns a single dao', async function() {
        const user = await this.User.findByPk(this.user.id);
        expect(Array.isArray(user)).to.not.be.ok;
        expect(user.id).to.equal(this.user.id);
        // expect(user.id).to.equal(1);
      });

      // Edited Test
      // Reason: This test expects id to be 1. 
      // CRDB does not work with human-readable ids by default.
      it('returns a single dao given a string id', async function() {
        const user = await this.User.findByPk(this.user.id.toString());
        expect(Array.isArray(user)).to.not.be.ok;
        expect(user.id).to.equal(this.user.id);
        // expect(user.id).to.equal(1);
      });

      // Edited test
      // Reason: This test tries to find id 1, which does not exist.
      it('should make aliased attributes available', async function() {
        const user = await this.User.findOne({
          // used the id from beforeEach created user
          where: { id: this.user.id },
          attributes: ['id', ['username', 'name']]
        });

        expect(user.dataValues.name).to.equal('barfooz');
      });

      // Edited test
      // Reason: CRDB does not work with human-readable ids.
      it('should allow us to find IDs using capital letters', async function() {
        const User = this.sequelize.define(`User${config.rand()}`, {
          ID: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          Login: { type: Sequelize.STRING }
        });

        await User.sync({ force: true });
        await User.create({ ID: 1, Login: 'foo' });
        const user = await User.findByPk(1);
        expect(user).to.exist;
        expect(user.ID).to.equal(1);
      });

      // Reason: CockroachDB does not yet support CITEXT
      // Seen here: https://github.com/cockroachdb/cockroach/issues/22463
      it.skip('should allow case-insensitive find on CITEXT type', async function() {
        const User = this.sequelize.define('UserWithCaseInsensitiveName', {
          username: Sequelize.CITEXT
        });

        await User.sync({ force: true });
        await User.create({ username: 'longUserNAME' });
        const user = await User.findOne({ where: { username: 'LONGusername' } });
        expect(user).to.exist;
        expect(user.username).to.equal('longUserNAME');
      });

      // Reason: CockroachDB does not yet support TSVECTOR
      // Seen here: https://github.com/cockroachdb/cockroach/issues/41288
      it.skip('should allow case-sensitive find on TSVECTOR type', async function() {
        const User = this.sequelize.define('UserWithCaseInsensitiveName', {
          username: Sequelize.TSVECTOR
        });

        await User.sync({ force: true });
        await User.create({ username: 'longUserNAME' });
        const user = await User.findOne({
          where: { username: 'longUserNAME' }
        });
        expect(user).to.exist;
        expect(user.username).to.equal("'longUserNAME'");
      });
    });

    describe('rejectOnEmpty mode', () => {
      // Edited test
      // Reason: This test uses originally a number which is neither a valid Int or BigInt.
      // Edited the PK to be zero, so it will be not found and achieve the test purpose.
      it('throws error when record not found by findByPk', async function() {
        // 4732322332323333232344334354234 originally on Sequelize test suite
        await expect(this.User.findByPk(0, {
          rejectOnEmpty: true
        })).to.eventually.be.rejectedWith(Sequelize.EmptyResultError);
      });
    });
  });
});