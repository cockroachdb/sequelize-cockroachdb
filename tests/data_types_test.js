'use strict';

require('./helper');

const { expect } = require('chai'),
  { Sequelize, DataTypes } = require('../source'),
  sinon = require('sinon'),
  _ = require('lodash'),
  Op = Sequelize.Op,
  dialect = 'postgres';

describe('DataTypes', function () {
  afterEach(function () {
    // Restore some sanity by resetting all parsers
    this.sequelize.connectionManager._clearTypeParser();
    this.sequelize.connectionManager.refreshTypeParser(DataTypes[dialect]); // Reload custom parsers
  });

  const testSuccess = async function (sequelize, Type, value, options) {
    const parse = (Type.constructor.parse = sinon.spy(value => {
      return value;
    }));

    const stringify = (Type.constructor.prototype.stringify = sinon.spy(
      function () {
        return Sequelize.ABSTRACT.prototype.stringify.apply(this, arguments);
      }
    ));
    let bindParam;
    if (options && options.useBindParam) {
      bindParam = Type.constructor.prototype.bindParam = sinon.spy(function () {
        return Sequelize.ABSTRACT.prototype.bindParam.apply(this, arguments);
      });
    }

    const User = sequelize.define(
      'user',
      {
        field: Type
      },
      {
        timestamps: false
      }
    );

    await sequelize.sync({ force: true });

    sequelize.refreshTypes();

    await User.create({
      field: value
    });

    await User.findAll();

    expect(parse).to.have.been.called;
    if (options && options.useBindParam) {
      expect(bindParam).to.have.been.called;
    } else {
      expect(stringify).to.have.been.called;
    }

    delete Type.constructor.parse;
    delete Type.constructor.prototype.stringify;
    if (options && options.useBindParam) {
      delete Type.constructor.prototype.bindParam;
    }
  };

  // Skip reason: In CRDB, JSON is an alias for JSONB. Although calling testSuccess with JSON
  // It'll return the data and parse it as the JSONB it is.
  // https://www.cockroachlabs.com/docs/v20.2/jsonb.html
  it.skip('calls parse and stringify for JSON', async function () {
    const Type = new Sequelize.JSON();

    await testSuccess(this.sequelize, Type, {
      test: 42,
      nested: { foo: 'bar' }
    });
  });

  // Skip reason: CRDB does not support HSTORE Type.
  // https://www.cockroachlabs.com/docs/v20.2/data-types.html
  it.skip('calls parse and bindParam for HSTORE', async function () {
    const Type = new Sequelize.HSTORE();

    await testSuccess(
      this.sequelize,
      Type,
      { test: 42, nested: false },
      { useBindParam: true }
    );
  });

  // Skip reason: CRDB does not support RANGE Type.
  // https://www.cockroachlabs.com/docs/v20.2/data-types.html
  it.skip('calls parse and bindParam for RANGE', async function () {
    const Type = new Sequelize.RANGE(new Sequelize.INTEGER());

    await testSuccess(this.sequelize, Type, [1, 2], { useBindParam: true });
  });

  // Skip reason: CRDB uses 8 byte INTEGER instead of PG 4 byte.
  // CRDB: https://www.cockroachlabs.com/docs/v20.2/int
  // PG: https://www.postgresql.org/docs/9.5/datatype-numeric.html
  // To treat it Sequelize-friendly, Type should be Sequelize.BIGINT()
  // instead of Sequelize.INTEGER().
  it.skip('calls parse and stringify for INTEGER', async function () {
    const Type = new Sequelize.INTEGER();

    await testSuccess(this.sequelize, Type, 1);
  });

  // Skip reason: CRDB does not support CIDR Type.
  // https://www.cockroachlabs.com/docs/v20.2/data-types.html
  it.skip('calls parse and stringify for CIDR', async function () {
    const Type = new Sequelize.CIDR();

    await testSuccess(this.sequelize, Type, '10.1.2.3/32');
  });

  // Skip reason: CRDB does not support CITEXT Type.
  // https://www.cockroachlabs.com/docs/v20.2/data-types.html
  it.skip('calls parse and stringify for CITEXT', async function () {
    const Type = new Sequelize.CITEXT();

    await testSuccess(this.sequelize, Type, 'foobar');
  });

  // Skip reason: CRDB does not support MACADDR Type.
  // https://www.cockroachlabs.com/docs/v20.2/data-types.html
  it.skip('calls parse and stringify for MACADDR', async function () {
    const Type = new Sequelize.MACADDR();

    await testSuccess(this.sequelize, Type, '01:23:45:67:89:ab');
  });

  // Skip reason: CRDB does not support TSVECTOR Type.
  // https://www.cockroachlabs.com/docs/v20.2/data-types.html
  it.skip('calls parse and stringify for TSVECTOR', async function () {
    const Type = new Sequelize.TSVECTOR();

    await testSuccess(this.sequelize, Type, 'swagger');
  });

  // TODO get back at it when possible
  // Fail reason: SEQUELIZE for some reason is not validating Infinity as a Float or DOUBLE.
  // https://github.com/sequelize/sequelize/blob/main/lib/data-types.js#L209
  // throws: SequelizeValidationError: null is not a valid double precision
  // Issue: https://github.com/sequelize/sequelize/issues/13274
  it.skip('should store and parse IEEE floating point literals (NaN and Infinity)', async function () {
    const Model = this.sequelize.define('model', {
      float: Sequelize.FLOAT,
      double: Sequelize.DOUBLE,
      real: Sequelize.REAL
    });

    await Model.sync({ force: true });

    const r = await Model.create({
      id: 1,
      float: NaN,
      double: Infinity,
      real: -Infinity
    });

    const user = await Model.findOne({ where: { id: 1 } });
    expect(user.get('float')).to.be.NaN;
    expect(user.get('double')).to.eq(Infinity);
    expect(user.get('real')).to.eq(-Infinity);
  });

  // Skip reason: CRDB does not support RANGE.
  // https://www.cockroachlabs.com/docs/v20.2/data-types.html
  it.skip('should return Int4 range properly #5747', async function () {
    const Model = this.sequelize.define('M', {
      interval: {
        type: Sequelize.RANGE(Sequelize.INTEGER),
        allowNull: false,
        unique: true
      }
    });

    await Model.sync({ force: true });
    await Model.create({ interval: [1, 4] });
    const [m] = await Model.findAll();
    expect(m.interval[0].value).to.be.eql(1);
    expect(m.interval[1].value).to.be.eql(4);
  });

  // Skip reason: All tests below expect RANGE Type. CRDB does not support it.
  // https://www.cockroachlabs.com/docs/v20.2/data-types.html
  // if (current.dialect.supports.RANGE) {
  it.skip('should allow date ranges to be generated with default bounds inclusion #8176', async function () {
    const Model = this.sequelize.define('M', {
      interval: {
        type: Sequelize.RANGE(Sequelize.DATE),
        allowNull: false,
        unique: true
      }
    });
    const testDate1 = new Date();
    const testDate2 = new Date(testDate1.getTime() + 10000);
    const testDateRange = [testDate1, testDate2];

    await Model.sync({ force: true });
    await Model.create({ interval: testDateRange });
    const m = await Model.findOne();
    expect(m).to.exist;
    expect(m.interval[0].value).to.be.eql(testDate1);
    expect(m.interval[1].value).to.be.eql(testDate2);
    expect(m.interval[0].inclusive).to.be.eql(true);
    expect(m.interval[1].inclusive).to.be.eql(false);
  });

  it.skip('should allow date ranges to be generated using a single range expression to define bounds inclusion #8176', async function () {
    const Model = this.sequelize.define('M', {
      interval: {
        type: Sequelize.RANGE(Sequelize.DATE),
        allowNull: false,
        unique: true
      }
    });
    const testDate1 = new Date();
    const testDate2 = new Date(testDate1.getTime() + 10000);
    const testDateRange = [
      { value: testDate1, inclusive: false },
      { value: testDate2, inclusive: true }
    ];

    await Model.sync({ force: true });
    await Model.create({ interval: testDateRange });
    const m = await Model.findOne();
    expect(m).to.exist;
    expect(m.interval[0].value).to.be.eql(testDate1);
    expect(m.interval[1].value).to.be.eql(testDate2);
    expect(m.interval[0].inclusive).to.be.eql(false);
    expect(m.interval[1].inclusive).to.be.eql(true);
  });

  it.skip('should allow date ranges to be generated using a composite range expression #8176', async function () {
    const Model = this.sequelize.define('M', {
      interval: {
        type: Sequelize.RANGE(Sequelize.DATE),
        allowNull: false,
        unique: true
      }
    });
    const testDate1 = new Date();
    const testDate2 = new Date(testDate1.getTime() + 10000);
    const testDateRange = [testDate1, { value: testDate2, inclusive: true }];

    await Model.sync({ force: true });
    await Model.create({ interval: testDateRange });
    const m = await Model.findOne();
    expect(m).to.exist;
    expect(m.interval[0].value).to.be.eql(testDate1);
    expect(m.interval[1].value).to.be.eql(testDate2);
    expect(m.interval[0].inclusive).to.be.eql(true);
    expect(m.interval[1].inclusive).to.be.eql(true);
  });

  it.skip('should correctly return ranges when using predicates that define bounds inclusion #8176', async function () {
    const Model = this.sequelize.define('M', {
      interval: {
        type: Sequelize.RANGE(Sequelize.DATE),
        allowNull: false,
        unique: true
      }
    });
    const testDate1 = new Date();
    const testDate2 = new Date(testDate1.getTime() + 10000);
    const testDateRange = [testDate1, testDate2];
    const dateRangePredicate = [
      { value: testDate1, inclusive: true },
      { value: testDate1, inclusive: true }
    ];

    await Model.sync({ force: true });
    await Model.create({ interval: testDateRange });

    const m = await Model.findOne({
      where: {
        interval: { [Op.overlap]: dateRangePredicate }
      }
    });

    expect(m).to.exist;
  });

  // GEOMETRY is not yet working with this ORM.
  // https://github.com/cockroachdb/sequelize-cockroachdb/issues/52
  // Error: SequelizeDatabaseError: st_geomfromgeojson(): could not determine data type of placeholder $1.
  it.skip('calls parse and bindParam for GEOMETRY', async function () {
    const Type = new Sequelize.GEOMETRY();

    console.log(this.sequelize)
    await testSuccess(this.sequelize, Type, { type: 'Point', coordinates: [125.6, 10.1] }, { useBindParam: true });
  });
});
