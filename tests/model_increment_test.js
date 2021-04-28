'use strict';

require('./helper');

const { expect } = require('chai'),
  DataTypes = require('../source'),
  sinon = require('sinon');

describe('Model', () => {
  before(function () {
    this.clock = sinon.useFakeTimers();
  });

  after(function () {
    this.clock.restore();
  });

  ['increment', 'decrement'].forEach(method => {
    describe(method, () => {
      before(function () {
        this.assert = (increment, decrement) => {
          return method === 'increment' ? increment : decrement;
        };
      });

      // Edited test:
      // Refactored to dynamically get the created user id.
      it('with timestamps set to true', async function () {
        const User = this.sequelize.define(
          'IncrementUser',
          {
            aNumber: DataTypes.INTEGER
          },
          { timestamps: true }
        );

        await User.sync({ force: true });
        const createdUser = await User.create({ aNumber: 1 });
        const oldDate = createdUser.updatedAt;

        this.clock.tick(1000);
        await User[method]('aNumber', { by: 1, where: {} });

        // Removed .eventually method, from chai-as-promised.
        const foundUser = await User.findByPk(createdUser.id);
        await expect(foundUser)
          .to.have.property('updatedAt')
          .afterTime(oldDate);
      });

      // Edited test:
      // Refactored to dynamically get the created user id.
      it('with timestamps set to true and options.silent set to true', async function () {
        const User = this.sequelize.define(
          'IncrementUser',
          {
            aNumber: DataTypes.INTEGER
          },
          { timestamps: true }
        );

        await User.sync({ force: true });
        const createdUser = await User.create({ aNumber: 1 });
        const oldDate = createdUser.updatedAt;

        this.clock.tick(1000);
        await User[method]('aNumber', { by: 1, silent: true, where: {} });

        // Removed .eventually method, from chai-as-promised.
        const foundUser = await User.findByPk(createdUser.id);
        await expect(foundUser)
          .to.have.property('updatedAt')
          .equalTime(oldDate);
      });
    });
  });
});
