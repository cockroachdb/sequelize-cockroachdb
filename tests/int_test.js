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

for (const intTypeName of ['integer', 'bigint']) {
  const intType = DataTypes[intTypeName.toUpperCase()];

  describe('DataTypes.' + intType.key, function () {
    beforeEach(async function () {
      this.Foo = this.sequelize.define('foo', {
        i: intType
      });

      await this.Foo.sync({ force: true });
    });

    it('accepts JavaScript integers', async function () {
      const foo = await this.Foo.create({ i: 42 });
      expect(foo.i).to.equal(42);
    });

    it('accepts JavaScript strings that represent 64-bit integers', async function () {
      const foo = await this.Foo.create({ i: "9223372036854775807" });
      expect(foo.i).to.equal(9223372036854775807n);
    });

    it('rejects integers that overflow', async function () {
      await expect(
        this.Foo.create({ i: "9223372036854775808" })
      ).to.be.eventually.rejectedWith('value out of range');
    });

    it('rejects garbage', async function () {
      await expect(
        this.Foo.create({ i: "102.3" })
      ).to.be.eventually.rejectedWith(`"102.3" is not a valid ${intTypeName}`);
    });

    it('rejects dangerous input', async function () {
      await expect(
        this.Foo.create({ i: "'" })
      ).to.be.eventually.rejectedWith(`"\'" is not a valid ${intTypeName}`);
    });
  });
}
