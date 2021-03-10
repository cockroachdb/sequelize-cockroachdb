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

describe('findOrCreate', function () {
  it('supports CockroachDB', function () {
    expect(Sequelize.supportsCockroachDB).to.be.true;
  });

  it('creates a row when missing', async function () {
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
    const origName = 'original';

    await User.sync({force: true});

    const [user, created] = await User.findOrCreate({
      where: {
        id: id1,
        name: origName,
      }
    });

    expect(user.name).to.equal(origName);
    expect(user.updatedAt).to.equalTime(user.createdAt);
    expect(created).to.be.true;

    const userAgain = await User.findByPk(id1);

    expect(userAgain.name).to.equal(origName);
    expect(userAgain.updatedAt).to.equalTime(userAgain.createdAt);
  });

  it('finds the row when present', async function () {
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
    const origName = 'original';
    const updatedName = "UPDATED";

    await User.sync({force: true});

    const user = await User.create({
      id: id1,
      name: origName,
    });

    expect(user.name).to.equal(origName);
    expect(user.updatedAt).to.equalTime(user.createdAt);

    const [userAgain, created] = await User.findOrCreate({
      where: {
        id: id1,
      },
      defaults: {
        name: updatedName
      }
    });

    expect(userAgain.name).to.equal(origName);
    expect(userAgain.updatedAt).to.equalTime(userAgain.createdAt);
    expect(created).to.be.false;
  });
});
