'use strict';

require('./helper');

const { expect } = require('chai'),
  DataTypes = require('../source');

describe('Instance', () => {
  describe('toJSON', () => {
    beforeEach(async function () {
      this.User = this.sequelize.define(
        'User',
        {
          username: { type: DataTypes.STRING },
          age: DataTypes.INTEGER,
          level: { type: DataTypes.INTEGER },
          isUser: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
          },
          isAdmin: { type: DataTypes.BOOLEAN }
        },
        {
          timestamps: false
        }
      );

      this.Project = this.sequelize.define(
        'NiceProject',
        { title: DataTypes.STRING },
        { timestamps: false }
      );

      this.User.hasMany(this.Project, {
        as: 'Projects',
        foreignKey: 'lovelyUserId'
      });
      this.Project.belongsTo(this.User, {
        as: 'LovelyUser',
        foreignKey: 'lovelyUserId'
      });

      await this.User.sync({ force: true });

      await this.Project.sync({ force: true });
    });

    describe('create', () => {
      // Edited test
      // CRDB ids are BigInt by default. This patch treats BigInts as Strings, since BigInts are not serializable.
      it('returns a response that can be stringified', async function () {
        const user = await this.User.create({
          username: 'test.user',
          age: 99,
          isAdmin: true,
          isUser: false,
          level: null
        });

        // changed this to expect a String ID.
        expect(JSON.stringify(user)).to.deep.equal(
          `{"id":"${user.get(
            'id'
          )}","username":"test.user","age":99,"isAdmin":true,"isUser":false,"level":null}`
        );
      });
    });

    describe('find', () => {
      // Edited test
      // CRDB ids are BigInt by default. This patch treats BigInts as Strings, since BigInts are not serializable.
      it('returns a response that can be stringified', async function () {
        const user0 = await this.User.create({
          username: 'test.user',
          age: 99,
          isAdmin: true,
          isUser: false
        });

        const user = await this.User.findByPk(user0.get('id'));

        // changed THIS to expect a String ID.
        expect(JSON.stringify(user)).to.deep.equal(
          `{"id":"${user.get(
            'id'
          )}","username":"test.user","age":99,"level":null,"isUser":false,"isAdmin":true}`
        );
      });
    });
  });
});
