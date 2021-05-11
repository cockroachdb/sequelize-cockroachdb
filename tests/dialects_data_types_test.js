'use strict';

const { expect } = require('chai');

describe('[POSTGRES Specific] Data Types', () => {
  describe('DATE SQL', () => {
    // Skip reason: There is a known issue with CRDB to treat correctly Infinity in DATE Type.
    // https://github.com/cockroachdb/cockroach/issues/41564
    // create dummy user
    it.skip('should be able to create and update records with Infinity/-Infinity', async function () {
      this.sequelize.options.typeValidation = true;

      const date = new Date();
      const User = this.sequelize.define(
        'User',
        {
          username: this.sequelize.Sequelize.STRING,
          beforeTime: {
            type: this.sequelize.Sequelize.DATE,
            defaultValue: -Infinity
          },
          sometime: {
            type: this.sequelize.Sequelize.DATE,
            defaultValue: this.sequelize.fn('NOW')
          },
          anotherTime: {
            type: this.sequelize.Sequelize.DATE
          },
          afterTime: {
            type: this.sequelize.Sequelize.DATE,
            defaultValue: Infinity
          }
        },
        {
          timestamps: true
        }
      );

      await User.sync({
        force: true
      });

      const user4 = await User.create(
        {
          username: 'bob',
          anotherTime: Infinity
        },
        {
          validate: true
        }
      );

      expect(user4.username).to.equal('bob');
      expect(user4.beforeTime).to.equal(-Infinity);
      expect(user4.sometime).to.be.withinTime(date, new Date());
      expect(user4.anotherTime).to.equal(Infinity);
      expect(user4.afterTime).to.equal(Infinity);

      const user3 = await user4.update(
        {
          sometime: Infinity
        },
        {
          returning: true
        }
      );

      expect(user3.sometime).to.equal(Infinity);

      const user2 = await user3.update({
        sometime: Infinity
      });

      expect(user2.sometime).to.equal(Infinity);

      const user1 = await user2.update(
        {
          sometime: this.sequelize.fn('NOW')
        },
        {
          returning: true
        }
      );

      expect(user1.sometime).to.be.withinTime(date, new Date());

      // find
      const users = await User.findAll();
      expect(users[0].beforeTime).to.equal(-Infinity);
      expect(users[0].sometime).to.not.equal(Infinity);
      expect(users[0].afterTime).to.equal(Infinity);

      const user0 = await users[0].update({
        sometime: date
      });

      expect(user0.sometime).to.equalTime(date);

      const user = await user0.update({
        sometime: date
      });

      expect(user.sometime).to.equalTime(date);
    });
  });
});
