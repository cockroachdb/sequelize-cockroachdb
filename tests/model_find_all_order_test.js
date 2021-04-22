'use strict';

require('./helper');

const DataTypes = require('../source');

describe('Model', () => {
  describe('findAll', () => {
    describe('order', () => {
      describe('injections', () => {
        beforeEach(async function() {
          this.User = this.sequelize.define('user', {
            name: DataTypes.STRING
          });
          this.Group = this.sequelize.define('group', {

          });
          this.User.belongsTo(this.Group);
          await this.sequelize.sync({ force: true });
        });

        // Reason: Not implemented yet.
        // https://www.cockroachlabs.com/docs/stable/null-handling.html#nulls-and-sorting
        it.skip('should not throw with on NULLS LAST/NULLS FIRST', async function() {
          await this.User.findAll({
            include: [this.Group],
            order: [
              ['id', 'ASC NULLS LAST'],
              [this.Group, 'id', 'DESC NULLS FIRST']
            ]
          });
        });
      });
    });
  });
});
