'use strict';

const { expect } = require('chai');
const { Sequelize, DataTypes } = require('../source');
const dialect = 'postgres';
const sinon = require('sinon');

const qq = str => {
  if (dialect === 'postgres' || dialect === 'mssql') {
    return `"${str}"`;
  }
  if (dialect === 'mysql' || dialect === 'mariadb' || dialect === 'sqlite') {
    return `\`${str}\``;
  }
  return str;
};

const Support = {
  // Copied from helper, to attend to a specific Sequelize instance creation.
  createSequelizeInstance: options => {
    return new Sequelize('sequelize_test', 'root', '', {
      dialect: 'postgres',
      port: process.env.COCKROACH_PORT || 26257,
      logging: false,
      typeValidation: true,
      benchmark: options.benchmark || false,
      logQueryParameters: options.logQueryParameters || false,
      minifyAliases: options.minifyAliases || false
    });
  }
};

const semver = require('semver');
const version_helper = require('../source/version_helper.js')
const crdbVersion = version_helper.GetCockroachDBVersionFromEnvConfig()
const isCRDBVersion21_1 =  crdbVersion ? semver.satisfies(crdbVersion, ">=21.1.0 <21.2.0") : false

describe('Sequelize', () => {
  describe('query', () => {
    afterEach(function () {
      this.sequelize.options.quoteIdentifiers = true;
      console.log.restore && console.log.restore();
    });

    beforeEach(async function () {
      this.User = this.sequelize.define('User', {
        username: {
          type: Sequelize.STRING,
          unique: true
        },
        emailAddress: {
          type: Sequelize.STRING,
          field: 'email_address'
        }
      });

      this.insertQuery = `INSERT INTO ${qq(
        this.User.tableName
      )} (username, email_address, ${qq('createdAt')}, ${qq(
        'updatedAt'
      )}) VALUES ('john', 'john@gmail.com', '2012-01-01 10:10:10', '2012-01-01 10:10:10')`;

      await this.User.sync({ force: true });
    });

    describe('retry', () => {
      // Edited test:
      // CRDB does not generate Details field, so Sequelize does not describe error as
      // Validation error. Changed retry's matcher to match CRDB error.
      // https://github.com/cockroachdb/cockroach/issues/63332
      // Skip if CRDB Version is 21.1.
      // Reason: callCount is only 1.
      (isCRDBVersion21_1 ? it.skip : it)('properly bind parameters on extra retries', async function () {
        const payload = {
          username: 'test',
          createdAt: '2010-10-10 00:00:00',
          updatedAt: '2010-10-10 00:00:00'
        };

        const spy = sinon.spy();

        await this.User.create(payload);

        await expect(
          this.sequelize.query(
            `
          INSERT INTO ${qq(this.User.tableName)} (username,${qq(
              'createdAt'
            )},${qq('updatedAt')}) VALUES ($username,$createdAt,$updatedAt);
        `,
            {
              bind: payload,
              logging: spy,
              retry: {
                max: 3,
                // PG matcher
                // match: [/Validation/]
                // CRDB matcher
                match: [/violates unique constraint/]
              }
            }
          )
        ).to.be.rejectedWith(Sequelize.UniqueConstraintError);

        expect(spy.callCount).to.eql(3);
      });
    });

    describe('logging', () => {
      describe('with logQueryParameters', () => {
        beforeEach(async function () {
          this.sequelize = Support.createSequelizeInstance({
            benchmark: true,
            logQueryParameters: true
          });
          this.User = this.sequelize.define(
            'User',
            {
              id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
              },
              username: {
                type: DataTypes.STRING
              },
              emailAddress: {
                type: DataTypes.STRING
              }
            },
            {
              timestamps: false
            }
          );

          await this.User.sync({ force: true });
        });

        // Edit Reason:
        // CRDB does not guarantee that ID will start at 1.
        it('add parameters in log sql', async function () {
          let createSql, updateSql;

          const user = await this.User.create(
            {
              username: 'john',
              emailAddress: 'john@gmail.com'
            },
            {
              logging: s => {
                createSql = s;
              }
            }
          );

          user.username = 'li';

          await user.save({
            logging: s => {
              updateSql = s;
            }
          });

          expect(createSql).to.match(
            /; ("john", "john@gmail.com"|{"(\$1|0)":"john","(\$2|1)":"john@gmail.com"})/
          );
          // Edited REGEX. ID is not guaranteed to be 1.
          // Will match a CRDB ID between quotes (String), as this adapter treats it.
          expect(updateSql).to.match(
            /; ("li", "[0-9]+"|{"(\$1|0)":"li","(\$2|1)":1})/
          );
        });
      });
    });
  });
});
