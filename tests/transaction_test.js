'use strict';

require('./helper');

const { expect } = require('chai');
const { Sequelize, DataTypes, Transaction } = require('../source');
const sinon = require('sinon');
const delay = require('delay');
const pSettle = require('p-settle');
const Support = require('./support');
const current = Support.sequelize;

describe('Transaction', function () {
  beforeEach(function () {
    this.sinon = sinon.createSandbox();
  });

  afterEach(function () {
    this.sinon.restore();
  });

  describe('autoCallback', function () {
    // Skip reason:
    // CRDB does not process concurrent transactions. 'secondTransaction' will only be processed when 'firstTransaction' finishes.
    // Issue: https://github.com/cockroachdb/sequelize-cockroachdb/issues/66

    // See #3689, #3726 and #6972 (https://github.com/sequelize/sequelize/pull/6972/files#diff-533eac602d424db379c3d72af5089e9345fd9d3bbe0a26344503c22a0a5764f7L75)
    it.skip('does not try to rollback a transaction that failed upon committing with SERIALIZABLE isolation level (#3689)', async function () {
      // See https://wiki.postgresql.org/wiki/SSI

      const Dots = this.sequelize.define('dots', { color: Sequelize.STRING });
      await Dots.sync({ force: true });

      const initialData = [
        { color: 'red' },
        { color: 'green' },
        { color: 'green' },
        { color: 'red' },
        { color: 'green' },
        { color: 'red' },
        { color: 'green' },
        { color: 'green' },
        { color: 'green' },
        { color: 'red' },
        { color: 'red' },
        { color: 'red' },
        { color: 'green' },
        { color: 'red' },
        { color: 'red' },
        { color: 'red' },
        { color: 'green' },
        { color: 'red' }
      ];

      await Dots.bulkCreate(initialData);

      const isolationLevel = Transaction.ISOLATION_LEVELS.SERIALIZABLE;

      let firstTransactionGotNearCommit = false;
      let secondTransactionGotNearCommit = false;

      const firstTransaction = async () => {
        await this.sequelize.transaction({ isolationLevel }, async t => {
          await Dots.update(
            { color: 'red' },
            {
              where: { color: 'green' },
              transaction: t
            }
          );
          await delay(1500);
          firstTransactionGotNearCommit = true;
        });
      };

      const secondTransaction = async () => {
        await delay(500);
        await this.sequelize.transaction({ isolationLevel }, async t => {
          await Dots.update(
            { color: 'green' },
            {
              where: { color: 'red' },
              transaction: t
            }
          );

          // Sanity check - in this test we want this line to be reached before the
          // first transaction gets to commit
          expect(firstTransactionGotNearCommit).to.be.false;

          secondTransactionGotNearCommit = true;
        });
      };

      await expect(
        Promise.all([firstTransaction(), secondTransaction()])
      ).to.eventually.be.rejectedWith(
        'could not serialize access due to read/write dependencies among transactions'
      );

      expect(firstTransactionGotNearCommit).to.be.true;
      expect(secondTransactionGotNearCommit).to.be.true;

      // Only the second transaction worked
      expect(await Dots.count({ where: { color: 'red' } })).to.equal(0);
      expect(await Dots.count({ where: { color: 'green' } })).to.equal(
        initialData.length
      );
    });
  });

  describe('isolation levels', function () {
    // CRDB does not use READ COMMITED. Instead, all isolation levels are upgraded to SERIALIZABLE
    // https://www.cockroachlabs.com/docs/v20.2/transactions.html#isolation-levels
    it.skip('should read the most recent committed rows when using the READ COMMITTED isolation level', async function () {
      const User = this.sequelize.define('user', {
        username: Sequelize.STRING
      });

      await expect(
        this.sequelize.sync({ force: true }).then(() => {
          return this.sequelize.transaction(
            { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
            async transaction => {
              const users0 = await User.findAll({ transaction });
              expect(users0).to.have.lengthOf(0);
              await User.create({ username: 'jan' }); // Create a User outside of the transaction
              const users = await User.findAll({ transaction });
              expect(users).to.have.lengthOf(1); // We SHOULD see the created user inside the transaction
            }
          );
        })
      ).to.eventually.be.fulfilled;
    });
  });

  describe('row locking', function () {
    if (current.dialect.supports.skipLocked) {
      // Skip reason: unimplemented: SKIP LOCKED lock wait policy is not supported
      it.skip('supports for update with skip locked', async function () {
        const User = this.sequelize.define('user', {
          username: Sequelize.STRING,
          awesome: Sequelize.BOOLEAN
        });

        await this.sequelize.sync({ force: true });

        await Promise.all([
          User.create({ username: 'jan' }),
          User.create({ username: 'joe' })
        ]);

        const t1 = await this.sequelize.transaction();

        const results = await User.findAll({
          limit: 1,
          lock: true,
          transaction: t1
        });

        const firstUserId = results[0].id;
        const t2 = await this.sequelize.transaction();

        const secondResults = await User.findAll({
          limit: 1,
          lock: true,
          skipLocked: true,
          transaction: t2
        });

        expect(secondResults[0].id).to.not.equal(firstUserId);

        await Promise.all([t1.commit(), t2.commit()]);
      });
    }

    // Skip reason:
    // CRDB does not support it.
    it.skip('supports for share (i.e. `SELECT ... LOCK IN SHARE MODE`)', async function () {
      const verifySelectLockInShareMode = async () => {
        const User = this.sequelize.define(
          'user',
          {
            username: DataTypes.STRING,
            awesome: DataTypes.BOOLEAN
          },
          { timestamps: false }
        );

        await this.sequelize.sync({ force: true });
        const { id } = await User.create({ username: 'jan' });

        // First, we start a transaction T1 and perform a SELECT with it using the `LOCK.SHARE` mode (setting a shared mode lock on the row).
        // This will cause other sessions to be able to read the row but not modify it.
        // So, if another transaction tries to update those same rows, it will wait until T1 commits (or rolls back).
        // https://dev.mysql.com/doc/refman/5.7/en/innodb-locking-reads.html
        const t1 = await this.sequelize.transaction();
        await User.findByPk(id, { lock: t1.LOCK.SHARE, transaction: t1 });

        // Then we start another transaction T2 and see that it can indeed read the same row.
        const t2 = await this.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        });
        const t2Jan = await User.findByPk(id, { transaction: t2 });

        // Then, we want to see that an attempt to update that row from T2 will be queued until T1 commits.
        const executionOrder = [];
        const [t2AttemptData, t1AttemptData] = await pSettle([
          (async () => {
            try {
              executionOrder.push('Begin attempt to update via T2');
              await t2Jan.update({ awesome: false }, { transaction: t2 });
              executionOrder.push('Done updating via T2');
            } catch (error) {
              executionOrder.push('Failed to update via T2'); // Shouldn't happen
              throw error;
            }

            await delay(30);

            try {
              executionOrder.push('Attempting to commit T2');
              await t2.commit();
              executionOrder.push('Done committing T2');
            } catch {
              executionOrder.push('Failed to commit T2'); // Shouldn't happen
            }
          })(),
          (async () => {
            await delay(100);

            try {
              executionOrder.push('Begin attempt to read via T1');
              await User.findAll({ transaction: t1 });
              executionOrder.push('Done reading via T1');
            } catch (error) {
              executionOrder.push('Failed to read via T1'); // Shouldn't happen
              throw error;
            }

            await delay(150);

            try {
              executionOrder.push('Attempting to commit T1');
              await t1.commit();
              executionOrder.push('Done committing T1');
            } catch {
              executionOrder.push('Failed to commit T1'); // Shouldn't happen
            }
          })()
        ]);

        expect(t1AttemptData.isFulfilled).to.be.true;
        expect(t2AttemptData.isFulfilled).to.be.true;
        expect(t1.finished).to.equal('commit');
        expect(t2.finished).to.equal('commit');

        const expectedExecutionOrder = [
          'Begin attempt to update via T2',
          'Begin attempt to read via T1', // 100ms after
          'Done reading via T1', // right after
          'Attempting to commit T1', // 150ms after
          'Done committing T1', // right after
          'Done updating via T2', // right after
          'Attempting to commit T2', // 30ms after
          'Done committing T2' // right after
        ];

        // The order things happen in the database must be the one shown above. However, sometimes it can happen that
        // the calls in the JavaScript event loop that are communicating with the database do not match exactly this order.
        // In particular, it is possible that the JS event loop logs `'Done updating via T2'` before logging `'Done committing T1'`,
        // even though the database committed T1 first (and then rushed to complete the pending update query from T2).

        const anotherAcceptableExecutionOrderFromJSPerspective = [
          'Begin attempt to update via T2',
          'Begin attempt to read via T1', // 100ms after
          'Done reading via T1', // right after
          'Attempting to commit T1', // 150ms after
          'Done updating via T2', // right after
          'Done committing T1', // right after
          'Attempting to commit T2', // 30ms after
          'Done committing T2' // right after
        ];

        const executionOrderOk = Support.isDeepEqualToOneOf(executionOrder, [
          expectedExecutionOrder,
          anotherAcceptableExecutionOrderFromJSPerspective
        ]);

        if (!executionOrderOk) {
          throw new Error(
            `Unexpected execution order: ${executionOrder.join(' > ')}`
          );
        }
      };

      for (let i = 0; i < 3 * Support.getPoolMax(); i++) {
        await verifySelectLockInShareMode();
        await delay(10);
      }
    });
  });
});
