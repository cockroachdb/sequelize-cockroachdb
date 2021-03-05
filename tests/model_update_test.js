// Copyright 2021 The Cockroach Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
// implied. See the License for the specific language governing
// permissions and limitations under the License.

require('./helper');

const { expect } = require('chai');
const { Sequelize, DataTypes } = require('../source');
const sinon = require('sinon');

describe('Model', () => {
  describe('update', () => {
    beforeEach(async function() {
      this.Account = this.sequelize.define('Account', {
        ownerId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'owner_id'
        },
        name: {
          type: DataTypes.STRING
        }
      });
      await this.Account.sync({ force: true });
    });

    it('should only update the passed fields', async function() {
      const spy = sinon.spy();

      const account = await this.Account.create({ ownerId: 2 });

      await this.Account.update({
        name: Math.random().toString()
      }, {
        where: {
          id: account.get('id')
        },
        logging: spy
      });

      // The substring `ownerId` should not be found in the logged SQL
      expect(spy, 'Update query was issued when no data to update').to.have.not.been.calledWithMatch('ownerId');
    });

    describe('skips update query', () => {
      it('if no data to update', async function() {
        const spy = sinon.spy();

        await this.Account.create({ ownerId: 3 });

        const result = await this.Account.update({
          unknownField: 'haha'
        }, {
          where: {
            ownerId: 3
          },
          logging: spy
        });

        expect(result[0]).to.equal(0);
        expect(spy, 'Update query was issued when no data to update').to.have.not.been.called;
      });

      it('skips when timestamps disabled', async function() {
        const Model = this.sequelize.define('Model', {
          ownerId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'owner_id'
          },
          name: {
            type: DataTypes.STRING
          }
        }, {
          timestamps: false
        });
        const spy = sinon.spy();

        await Model.sync({ force: true });
        await Model.create({ ownerId: 3 });

        const result = await Model.update({
          unknownField: 'haha'
        }, {
          where: {
            ownerId: 3
          },
          logging: spy
        });

        expect(result[0]).to.equal(0);
        expect(spy, 'Update query was issued when no data to update').to.have.not.been.called;
      });
    });

    it('changed should be false after reload', async function() {
      const account0 = await this.Account.create({ ownerId: 2, name: 'foo' });
      account0.name = 'bar';
      expect(account0.changed()[0]).to.equal('name');
      const account = await account0.reload();
      expect(account.changed()).to.equal(false);
    });

    it('should ignore undefined values without throwing not null validation', async function() {
      const ownerId = 2;

      const account0 = await this.Account.create({
        ownerId,
        name: Math.random().toString()
      });

      await this.Account.update({
        name: Math.random().toString(),
        ownerId: undefined
      }, {
        where: {
          id: account0.get('id')
        }
      });

      const account = await this.Account.findOne();
      expect(account.ownerId).to.be.equal(ownerId);
    });
  });
});
