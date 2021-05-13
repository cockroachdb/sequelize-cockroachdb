'use strict';

require('./helper');

const chai = require('chai'),
  expect = chai.expect,
  Sequelize = require('../source');

describe('InstanceValidator', () => {
  describe('#update', () => {
    // Edited test. Changed findByPk parameter.
    it('should allow us to update specific columns without tripping the validations', async function() {
      const User = this.sequelize.define('model', {
        username: Sequelize.STRING,
        email: {
          type: Sequelize.STRING,
          allowNull: false,
          validate: {
            isEmail: {
              msg: 'You must enter a valid email address'
            }
          }
        }
      });

      await User.sync({ force: true });
      const user = await User.create({ username: 'bob', email: 'hello@world.com' });

      await User
        .update({ username: 'toni' }, { where: { id: user.id } });

      // Edited PK. It was 1, now it is dynamically obtained.
      const user0 = await User.findByPk(user.id);
      expect(user0.username).to.equal('toni');
    });

    // Reason: Errors array need DB-level details to be generated. Since it doesn't,
    // this test lacks details for its expectations.
    // https://github.com/cockroachdb/cockroach/issues/63332
    it.skip('should enforce a unique constraint', async function() {
      const Model = this.sequelize.define('model', {
        uniqueName: { type: Sequelize.STRING, unique: 'uniqueName' }
      });
      const records = [
        { uniqueName: 'unique name one' },
        { uniqueName: 'unique name two' }
      ];
      await Model.sync({ force: true });
      const instance0 = await Model.create(records[0]);
      expect(instance0).to.be.ok;
      const instance = await Model.create(records[1]);
      expect(instance).to.be.ok;
      await Model.update(records[0], { where: { id: instance.id } })
      const err = await expect(Model.update(records[0], { where: { id: instance.id } })).to.be.rejected;
      console.log(err);
      expect(err).to.be.an.instanceOf(Error);
      expect(err.errors).to.have.length(1);
      expect(err.errors[0].path).to.include('uniqueName');
      expect(err.errors[0].message).to.include('must be unique');
    });

    // Reason: Errors array need DB-level details to be generated. Since it doesn't,
    // this test lacks details for its expectations.
    // https://github.com/sequelize/sequelize/blob/main/lib/dialects/postgres/query.js#L319
    it.skip('should allow a custom unique constraint error message', async function() {
      const Model = this.sequelize.define('model', {
        uniqueName: {
          type: Sequelize.STRING,
          unique: { msg: 'custom unique error message' }
        }
      });
      const records = [
        { uniqueName: 'unique name one' },
        { uniqueName: 'unique name two' }
      ];
      await Model.sync({ force: true });
      const instance0 = await Model.create(records[0]);
      expect(instance0).to.be.ok;
      const instance = await Model.create(records[1]);
      expect(instance).to.be.ok;
      const err = await expect(Model.update(records[0], { where: { id: instance.id } })).to.be.rejected;
      expect(err).to.be.an.instanceOf(Error);
      expect(err.errors).to.have.length(1);
      expect(err.errors[0].path).to.include('uniqueName');
      expect(err.errors[0].message).to.equal('custom unique error message');
    });

    // Reason: Errors array need DB-level details to be generated. Since it doesn't,
    // this test lacks details for its expectations.
    // https://github.com/sequelize/sequelize/blob/main/lib/dialects/postgres/query.js#L319
    it.skip('should handle multiple unique messages correctly', async function() {
      const Model = this.sequelize.define('model', {
        uniqueName1: {
          type: Sequelize.STRING,
          unique: { msg: 'custom unique error message 1' }
        },
        uniqueName2: {
          type: Sequelize.STRING,
          unique: { msg: 'custom unique error message 2' }
        }
      });
      const records = [
        { uniqueName1: 'unique name one', uniqueName2: 'unique name one' },
        { uniqueName1: 'unique name one', uniqueName2: 'this is ok' },
        { uniqueName1: 'this is ok', uniqueName2: 'unique name one' }
      ];
      await Model.sync({ force: true });
      const instance = await Model.create(records[0]);
      expect(instance).to.be.ok;
      const err0 = await expect(Model.create(records[1])).to.be.rejected;
      expect(err0).to.be.an.instanceOf(Error);
      expect(err0.errors).to.have.length(1);
      expect(err0.errors[0].path).to.include('uniqueName1');
      expect(err0.errors[0].message).to.equal('custom unique error message 1');

      const err = await expect(Model.create(records[2])).to.be.rejected;
      expect(err).to.be.an.instanceOf(Error);
      expect(err.errors).to.have.length(1);
      expect(err.errors[0].path).to.include('uniqueName2');
      expect(err.errors[0].message).to.equal('custom unique error message 2');
    });
  });
});
