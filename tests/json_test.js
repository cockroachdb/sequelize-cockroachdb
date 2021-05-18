require('./helper');

const { expect } = require('chai');
const { DataTypes } = require('../source');

describe('model', () => {
  describe('json', () => {
    beforeEach(async function () {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        emergency_contact: DataTypes.JSON,
        emergencyContact: DataTypes.JSON
      });
      this.Order = this.sequelize.define('Order');
      this.Order.belongsTo(this.User);

      await this.sequelize.sync({ force: true });
    });

    // Reason: CockroachDB only supports JSONB. Creating a DataTypes.JSON, will create a .JSONB instead
    // The test originally expects to.equal(JSON);
    it('should tell me that a column is jsonb', async function () {
      const table = await this.sequelize.queryInterface.describeTable('Users');

      expect(table.emergency_contact.type).to.equal('JSONB');
    });
  });
});
