// Copyright 2017 The Cockroach Authors.
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

describe('Enum', function () {
  before(function() {
    this.Bar = this.sequelize.define('bar', {
      enum: Sequelize.ENUM('A', 'B')
    });
    return this.Bar.sync({ force: true });
  });

  it('accepts valid values', function () {
    this.Bar.create({ enum: 'A' }).then(function (bar) {
      expect(bar.enum).to.equal('A');
    });
  });

  it('rejects invalid values', function () {
    expect(this.Bar.create({ enum: 'C' }))
        .to.be.rejectedWith('"C" is not a valid choice in ["A","B"]');
  });
});

