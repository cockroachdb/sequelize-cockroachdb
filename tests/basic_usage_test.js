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
const { Sequelize, Op, DataTypes, UniqueConstraintError } = require('../source');
const sinon = require('sinon');

const wait = ms => new Promise(r => setTimeout(r, ms));

function deepToJson(value) {
  if (typeof value.toJSON === 'function') return value.toJSON();
  if (Array.isArray(value)) return value.map(x => deepToJson(x));
  return value;
}

function assertToJsonDeepEquality(actual, expected) {
  actual = deepToJson(actual);
  expected = deepToJson(expected);
  expect(deepToJson(actual)).to.be.deep.equal(deepToJson(expected));
}

describe('basic usage', function () {
  it('supports CockroachDB', function () {
    expect(Sequelize.supportsCockroachDB).to.be.true;
  });

  it('works', async function () {
    const Foo = this.sequelize.define('foo', {
      name1: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      name2: {
        type: DataTypes.STRING,
        unique: true
      }
    });
    const Bar = this.sequelize.define('bar', { name: DataTypes.STRING(10), date: DataTypes.DATE });
    const Baz = this.sequelize.define('baz', {
      id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        autoIncrement: false,
        allowNull: false
      },
      name: DataTypes.TEXT
    });
    const Qux = this.sequelize.define('qux', { age: DataTypes.INTEGER });

    Foo.hasMany(Bar);
    Bar.belongsTo(Foo);

    Bar.belongsToMany(Baz, { through: 'BarBaz' });
    Baz.belongsToMany(Bar, { through: 'BarBaz' });

    Foo.hasOne(Qux);
    Qux.belongsTo(Foo);

    const spy = sinon.spy();
    this.sequelize.afterBulkSync(() => spy());
    await this.sequelize.sync();
    expect(spy).to.have.been.called;

    const foo1 = await Foo.create({ name1: 'foo1', name2: 'foo2' });
    expect(foo1.id).to.be.ok;
    expect(foo1.isNewRecord).to.be.false;
    expect(foo1.get('name1')).to.equal('foo1');
    expect(foo1.name2).to.equal('foo2');

    expect(await Foo.count()).to.equal(1);

    await expect(
      Foo.create({ name1: 'foo1', name2: 'foo2' })
    ).to.be.eventually.rejectedWith(UniqueConstraintError);

    await expect(
      Bar.create({ name: 'this name does not fit' })
    ).to.be.eventually.rejectedWith(/too long/i);

    await expect(
      Bar.create({ name: 'bar0', fooId: 1234 })
    ).to.be.eventually.rejectedWith(/foreign key constraint/i);

    const bar1 = await Bar.create({ name: 'bar1', fooId: foo1.id });
    expect(bar1.id).to.be.ok;
    expect(bar1.isNewRecord).to.be.false;

    assertToJsonDeepEquality(await bar1.getFoo(), foo1);
    assertToJsonDeepEquality(await foo1.getBars(), [bar1]);
    assertToJsonDeepEquality(await Foo.findAll({ include: Bar }), [{ ...foo1.toJSON(), bars: [bar1.toJSON()] }]);

    const baz1 = await Baz.create({ name: 'baz1' });
    expect(typeof baz1.id).to.equal('string');

    const baz2 = await Baz.create({ name: null });
    expect(typeof baz2.id).to.equal('string');

    await bar1.addBaz(baz1);
    await baz2.addBar(bar1);

    expect(
      (await bar1.getBazs()).map(baz => baz.id).sort()
    ).to.be.deep.equal(
      [baz1, baz2].map(baz => baz.id).sort()
    );

    expect(
      this.sequelize.transaction(async transaction => {
        await baz1.update({ name: 'updated' }, { transaction });
        expect(baz1.name).to.equal('updated');
        throw new Error('test12345');
      })
    ).to.be.eventually.rejectedWith('test12345');

    expect(baz1.name).to.equal('baz1');
    await baz1.reload();
    expect(baz1.name).to.equal('baz1');
    expect((await Baz.findByPk(baz1.id)).name).to.equal('baz1');

    // Concurrent transactions
    const t1 = await this.sequelize.transaction();
    await Qux.create({ age: 10 }, { transaction: t1 });
    const t2 = await this.sequelize.transaction();
    await wait(500);
    await Qux.create({ age: 20 }, { transaction: t2 });
    const t3 = await this.sequelize.transaction();
    await Qux.create({ age: 40 }, { transaction: t3 });
    await wait(500);
    await Qux.create({ age: 80 }, { transaction: t2 });
    const t4 = await this.sequelize.transaction();
    const t5 = await this.sequelize.transaction();
    await t4.commit();
    await wait(500);
    const t6 = await this.sequelize.transaction();
    await wait(500);
    await t1.commit();
    const t7 = await this.sequelize.transaction();
    await Qux.create({ age: 160 }, { transaction: t7 });
    await Qux.create({ age: 320 }, { transaction: t3 });
    await t3.commit();
    await t2.rollback();
    await t5.commit();
    await t6.rollback();
    await t7.commit();

    expect(await Qux.sum('age')).to.equal(530);

    expect(
      await Qux.sum('age', { where: { age: { [Op.gt]: 30 } } })
    ).to.equal(520);

    expect(await Qux.count({ where: { age: { [Op.notIn]: [40, 160] } } })).to.equal(2);

    expect(
      await Qux.sum('age', {
        where: this.sequelize.where(
          this.sequelize.fn('mod', this.sequelize.col('age'), 9),
          Op.notIn,
          this.sequelize.literal('(4, 5)')
        )
      })
    ).to.equal(170);
  });
});
