'use strict';

const { expect } = require('chai');
const dialect = 'postgres';
const sinon = require('sinon');
const delay = require('delay');
const Support = require('./support');

function assertSameConnection(newConnection, oldConnection) {
  expect(oldConnection.processID).to.be.equal(newConnection.processID).and.to.be.ok;
}

function assertNewConnection(newConnection, oldConnection) {
  expect(oldConnection.processID).to.not.be.equal(newConnection.processID);
}

function attachMSSQLUniqueId(connection) {
  return connection;
}

// PG emits events to communicate with the pg client.
// CRDB apparently does not emit events like these, needed to compare processID:
// https://github.com/brianc/node-postgres/blob/master/packages/pg/lib/client.js#L185
describe.skip('Pooling', () => {
  if (dialect === 'sqlite' || process.env.DIALECT === 'postgres-native') return;

  beforeEach(function() {
    this.sinon = sinon.createSandbox();
  });

  afterEach(function() {
    this.sinon.restore();
  });

  describe('network / connection errors', () => {
    it('should obtain new connection when old connection is abruptly closed', async () => {
      function simulateUnexpectedError(connection) {
        connection.emit('error', { code: 'ECONNRESET' });
      }

      const sequelize = Support.createSequelizeInstance({
        pool: { max: 1, idle: 5000 }
      });
      const cm = sequelize.connectionManager;
      await sequelize.sync();

      const firstConnection = await cm.getConnection();
      simulateUnexpectedError(firstConnection);
      const secondConnection = await cm.getConnection();

      assertNewConnection(secondConnection, firstConnection);
      expect(cm.pool.size).to.equal(1);
      expect(cm.validate(firstConnection)).to.be.not.ok;

      await cm.releaseConnection(secondConnection);
    });

    it('should obtain new connection when released connection dies inside pool', async () => {
      function simulateUnexpectedError(connection) {
        if (dialect === 'postgres') {
          connection.end();
        } else {
          connection.close();
        }
      }

      const sequelize = Support.createSequelizeInstance({
        pool: { max: 1, idle: 5000 }
      });
      const cm = sequelize.connectionManager;
      await sequelize.sync();

      const oldConnection = await cm.getConnection();
      await cm.releaseConnection(oldConnection);
      simulateUnexpectedError(oldConnection);
      const newConnection = await cm.getConnection();

      assertNewConnection(newConnection, oldConnection);
      expect(cm.pool.size).to.equal(1);
      expect(cm.validate(oldConnection)).to.be.not.ok;

      await cm.releaseConnection(newConnection);
    });
  });

  describe('idle', () => {
    it('should maintain connection within idle range', async () => {
      const sequelize = Support.createSequelizeInstance({
        pool: { max: 1, idle: 100 }
      });
      const cm = sequelize.connectionManager;
      await sequelize.sync();

      const firstConnection = await cm.getConnection();

      // TODO - Do we really need this call?
      attachMSSQLUniqueId(firstConnection);

      // returning connection back to pool
      await cm.releaseConnection(firstConnection);

      // Wait a little and then get next available connection
      await delay(90);
      const secondConnection = await cm.getConnection();

      assertSameConnection(secondConnection, firstConnection);
      expect(cm.validate(firstConnection)).to.be.ok;

      await cm.releaseConnection(secondConnection);
    });

    it('should get new connection beyond idle range', async () => {
      const sequelize = Support.createSequelizeInstance({
        pool: { max: 1, idle: 100, evict: 10 }
      });
      const cm = sequelize.connectionManager;
      await sequelize.sync();

      const firstConnection = await cm.getConnection();

      // TODO - Do we really need this call?
      attachMSSQLUniqueId(firstConnection);

      // returning connection back to pool
      await cm.releaseConnection(firstConnection);

      // Wait a little and then get next available connection
      await delay(110);

      const secondConnection = await cm.getConnection();

      assertNewConnection(secondConnection, firstConnection);
      expect(cm.validate(firstConnection)).not.to.be.ok;

      await cm.releaseConnection(secondConnection);
    });
  });
});
