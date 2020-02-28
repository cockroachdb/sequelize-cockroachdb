// Copyright 2016 The Cockroach Authors.
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

var expect = require('chai').expect;
var Sequelize = require('..');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('findOrCreate', function () {
  it('supports CockroachDB', function () {
    expect(Sequelize.supportsCockroachDB).to.be.true;
  });

  it('creates a row when missing', function () {
    var User = this.sequelize.define('user', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
      },
    });

    const id1 = 1;
    const origName = 'original';

    return User.sync({force: true}).then(function () {
      return User.findOrCreate({
        where: {
          id: id1,
          name: origName,
        }
      });
    }).then(function([user, created]) {
      expect(user.name).to.equal(origName);
      expect(user.updatedAt).to.equalTime(user.createdAt);
      expect(created).to.be.true;
      return User.findByPk(id1);
    }).then(function(user) {
      expect(user.name).to.equal(origName);
      expect(user.updatedAt).to.equalTime(user.createdAt);
    });
  });

  it('finds the row when present', function () {
    var User = this.sequelize.define('user', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
      },
    });

    const id1 = 1;
    const origName = 'original';
    const updatedName = "UPDATED";

    return User.sync({force: true}).then(function () {
      return User.create({
        id: id1,
        name: origName,
      });
    }).then(function(user) {
      expect(user.name).to.equal(origName);
      expect(user.updatedAt).to.equalTime(user.createdAt);
      return User.findOrCreate({
        where: {
          id: id1,
        },
        defaults: {
          name: updatedName
        }
      });
    }).then(function([user, created]) {
      expect(user.name).to.equal(origName);
      expect(user.updatedAt).to.equalTime(user.createdAt);
      expect(created).to.be.false;
    });
  });
});
