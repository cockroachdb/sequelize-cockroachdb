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

describe('upsert', function () {
  it('supports CockroachDB', function () {
    expect(Sequelize.supportsCockroachDB).to.be.true;
  });

  it('updates at most one row', async function () {
    const User = this.sequelize.define('user', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING,
      },
    });

    const id1 = 1;
    const origName1 = 'original';
    const updatedName1 = "UPDATED";

    const id2 = 2;
    const name2 = 'other';

    await User.sync({force: true});
    const user1 = await User.create({
      id: id1,
      name: origName1,
    });

    expect(user1.name).to.equal(origName1);
    expect(user1.updatedAt).to.equalTime(user1.createdAt);

    const user2 = await User.create({
      id: id2,
      name: name2
    });

    expect(user2.name).to.equal(name2);
    expect(user2.updatedAt).to.equalTime(user2.createdAt);

    await User.upsert({
      id: id1,
      name: updatedName1
    });

    const user1Again = await User.findByPk(id1);

    expect(user1Again.name).to.equal(updatedName1);
    expect(user1Again.updatedAt).afterTime(user1Again.createdAt);

    const user2Again = await User.findByPk(id2);

    // Verify that the other row is unmodified.
    expect(user2Again.name).to.equal(name2);
    expect(user2Again.updatedAt).to.equalTime(user2Again.createdAt);
  });

  it('works with composite primary key', async function () {
    const Counter = this.sequelize.define('counter', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true
      },
      id2: {
        type: DataTypes.INTEGER,
        primaryKey: true
      },
      count: {
        type: DataTypes.INTEGER
      }
    });

    const id = 1000;
    const id2 = 2000;

    await Counter.sync({force: true});
    await Counter.create({ id: id, id2: id2, count: 1 });
    await Counter.upsert({ id: id, id2: id2, count: 2 });

    const counter = await Counter.findOne({where: {id: id, id2: id2}});

    expect(counter.count).to.equal(2);
    expect(counter.updatedAt).afterTime(counter.createdAt);
  });

  it('works with RETURNING', async function () {
    const User = this.sequelize.define('user', { name: DataTypes.STRING });
    await User.sync({ force: true });

    const { id } = await User.create({ name: 'Someone' });

    const [userReturnedFromUpsert1] = await User.upsert({ id, name: 'Another Name' }, { returning: true });
    const user1 = await User.findOne();

    expect(user1.name).to.equal('Another Name');
    expect(userReturnedFromUpsert1.name).to.equal('Another Name');

    const [userReturnedFromUpsert2] = await User.upsert({ id, name: 'Another Name 2' }, { returning: '*' });
    const user2 = await User.findOne();

    expect(user2.name).to.equal('Another Name 2');
    expect(userReturnedFromUpsert2.name).to.equal('Another Name 2');
  });
});
