require('./helper');

var expect = require('chai').expect;
var Sequelize = require('..');
var DataTypes = Sequelize.DataTypes;

// Reason: after merging with other patches started failing locally only
describe.skip('QueryInterface', () => {
  beforeEach(function() {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(async function() {
    this.queryInterface.dropTable('menus');
  });

  describe('dropEnum', () => {
    beforeEach(async function() {
     await this.queryInterface.createTable('menus',  {
        structuretype: {
          type: DataTypes.ENUM('menus', 'submenu', 'routine'),
          allowNull: true
        },
        sequence: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        name: {
          type: DataTypes.STRING,
          allowNull: true
        }
      });
    });

    it('should be able to drop the specified column', async function() {
      await this.queryInterface.removeColumn('menus', 'structuretype');
      const enumList0 = await this.queryInterface.pgListEnums('menus');

      expect(enumList0).to.have.lengthOf(1);
      expect(enumList0[0]).to.have.property('enum_name').and.to.equal('enum_menus_structuretype');
    });

    it('should be able to drop the specified enum', async function() {
      await this.queryInterface.dropEnum('enum_menus_structuretype');
      await this.queryInterface.dropEnum('enum_bars_enum');
      const enumList = await this.queryInterface.pgListEnums('menus');

      expect(enumList).to.be.an('array');
      expect(enumList).to.have.lengthOf(0);
    });
  });
});
