'use strict';

require('./helper');

const { expect } = require('chai'),
  DataTypes = require('../source');

describe('Dynamic OIDs', () => {
  // Edit Reason:
  // CRDB does not support HSTORE and CITEXT.
  const dynamicTypesToCheck = [
    DataTypes.GEOMETRY,
    // DataTypes.HSTORE,
    DataTypes.GEOGRAPHY
    // DataTypes.CITEXT
  ];

  // Expect at least these
  const expCastTypes = {
    integer: 'int4',
    decimal: 'numeric',
    date: 'timestamptz',
    dateonly: 'date',
    bigint: 'int8'
  };

  function reloadDynamicOIDs(sequelize) {
    // Reset oids so we need to refetch them
    sequelize.connectionManager._clearDynamicOIDs();
    sequelize.connectionManager._clearTypeParser();

    // Force start of connection manager to reload dynamic OIDs
    const User = sequelize.define('User', {
      perms: DataTypes.ENUM(['foo', 'bar'])
    });

    return User.sync({ force: true });
  }

  // Skip on CI:
  // Edited dynamicTypesToCheck
  it('should fetch regular dynamic oids and create parsers', async function () {
    const sequelize = this.sequelize;
    await reloadDynamicOIDs(sequelize);
    dynamicTypesToCheck.forEach(type => {
      expect(type.types.postgres, `DataType.${type.key}.types.postgres`).to.not
        .be.empty;

      for (const name of type.types.postgres) {
        const entry = sequelize.connectionManager.nameOidMap[name];
        const oidParserMap = sequelize.connectionManager.oidParserMap;
        expect(entry.oid, `nameOidMap[${name}].oid`).to.be.a('number');
        expect(entry.arrayOid, `nameOidMap[${name}].arrayOid`).to.be.a(
          'number'
        );

        expect(
          oidParserMap.get(entry.oid),
          `oidParserMap.get(nameOidMap[${name}].oid)`
        ).to.be.a('function');
        expect(
          oidParserMap.get(entry.arrayOid),
          `oidParserMap.get(nameOidMap[${name}].arrayOid)`
        ).to.be.a('function');
      }
    });
  });

  // Skip reason:
  // CRDB does not have Range types.
  it.skip('should fetch range dynamic oids and create parsers', async function () {
    const sequelize = this.sequelize;
    await reloadDynamicOIDs(sequelize);
    for (const baseKey in expCastTypes) {
      console.log(baseKey);
      const name = expCastTypes[baseKey];
      console.log(name);
      const entry = sequelize.connectionManager.nameOidMap[name];
      const oidParserMap = sequelize.connectionManager.oidParserMap;
      console.log(entry);

      for (const key of ['rangeOid', 'arrayRangeOid']) {
        expect(entry[key], `nameOidMap[${name}][${key}]`).to.be.a('number');
      }

      expect(
        oidParserMap.get(entry.rangeOid),
        `oidParserMap.get(nameOidMap[${name}].rangeOid)`
      ).to.be.a('function');
      expect(
        oidParserMap.get(entry.arrayRangeOid),
        `oidParserMap.get(nameOidMap[${name}].arrayRangeOid)`
      ).to.be.a('function');
    }
  });
});
