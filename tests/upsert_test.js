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

describe('upsert', function () {
  it('supports CockroachDB', function () {
    expect(Sequelize.supportsCockroachDB).to.be.true;
  });

  it('updates at most one row', function () {
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
    const origName1 = 'original';
    const updatedName1 = "UPDATED";

    const id2 = 2;
    const name2 = 'other';

    return User.sync({force: true}).then(function () {
      return User.create({
        id: id1,
        name: origName1,
      });
    }).then(function(user) {
      expect(user.name).to.equal(origName1);
      expect(user.updatedAt).to.equalTime(user.createdAt);
      return User.create({
        id: id2,
        name: name2
      });
    }).then(function(user) {
      expect(user.name).to.equal(name2);
      expect(user.updatedAt).to.equalTime(user.createdAt);

      return User.upsert({
        id: id1,
        name: updatedName1
      });
    }).then(function() {
      return User.findByPk(id1);
    }).then(function(user) {
      expect(user.name).to.equal(updatedName1);
      expect(user.updatedAt).afterTime(user.createdAt);

      return User.findByPk(id2);
    }).then(function(user) {
      // Verify that the other row is unmodified.
      expect(user.name).to.equal(name2);
      expect(user.updatedAt).to.equalTime(user.createdAt);
    });
  });

  it('works with composite primary key', function () {
    var Counter = this.sequelize.define('counter', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true
      },
      id2: {
        type: Sequelize.INTEGER,
        primaryKey: true
      },
      count: {
        type: Sequelize.INTEGER
      }
    });

    const id = 1000;
    const id2 = 2000;

    return Counter.sync({force:true}).then(function () {
      return Counter.create({
        id: id,
        id2: id2,
        count: 1,
      }).then(function(counter) {
        return Counter.upsert({
          id: id,
          id2: id2,
          count: 2
        });
      }).then(function() {
        return Counter.findOne({where: {id: id, id2: id2}});
      }).then(function(counter) {
        // For some reason, INTEGER columns are returned as strings, so we need
        // to cast.
        expect(parseInt(counter.count)).to.equal(2);
        expect(counter.updatedAt).afterTime(counter.createdAt);
      });
    });
  });

  it('throws error with RETURNING', function () {
    var User = this.sequelize.define('user', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
      },
    });

    return User.sync({force: true}).then(function () {
      return User.create({
        id: 1,
        name: "original",
      });
    }).then(function(user) {
      var options = {returning: "*"};
      return User.upsert({
        id: 1,
        name: "UPDATED"
      }, options).catch(function(e) {
        expect(e.message).to.contain("https://github.com/cockroachdb/cockroach/issues/6637");
      });
    });
  });
});
