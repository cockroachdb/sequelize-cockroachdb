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

describe('Enum', function () {
  beforeEach(async function() {
    this.Bar = this.sequelize.define('bar', {
      enum: DataTypes.ENUM('A', 'B')
    });
    await this.Bar.sync({ force: true });
  });

  it('accepts valid values', async function () {
    const bar = await this.Bar.create({ enum: 'A' });
    expect(bar.enum).to.equal('A');
  });

  it('rejects invalid values', async function () {
    await expect(
      this.Bar.create({ enum: 'C' })
    ).to.be.eventually.rejectedWith('"C" is not a valid choice in ["A","B"]');
  });
});
