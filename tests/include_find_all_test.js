'use strict';

require('./helper');

const chai = require('chai'),
  { DataTypes } = require('../source'),
  expect = chai.expect,
  _ = require('lodash');

describe('Include', () => {
  describe('findAll', () => {
    beforeEach(function() {
      this.fixtureA = async function() {
        const User = this.sequelize.define('User', {}),
          Company = this.sequelize.define('Company', {
            name: DataTypes.STRING
          }),
          Product = this.sequelize.define('Product', {
            title: DataTypes.STRING
          }),
          Tag = this.sequelize.define('Tag', {
            name: DataTypes.STRING
          }),
          Price = this.sequelize.define('Price', {
            value: DataTypes.FLOAT
          }),
          Customer = this.sequelize.define('Customer', {
            name: DataTypes.STRING
          }),
          Group = this.sequelize.define('Group', {
            name: DataTypes.STRING
          }),
          GroupMember = this.sequelize.define('GroupMember', {

          }),
          Rank = this.sequelize.define('Rank', {
            name: DataTypes.STRING,
            canInvite: {
              type: DataTypes.INTEGER,
              defaultValue: 0
            },
            canRemove: {
              type: DataTypes.INTEGER,
              defaultValue: 0
            },
            canPost: {
              type: DataTypes.INTEGER,
              defaultValue: 0
            }
          });

        this.models = {
          User,
          Company,
          Product,
          Tag,
          Price,
          Customer,
          Group,
          GroupMember,
          Rank
        };

        User.hasMany(Product);
        Product.belongsTo(User);

        Product.belongsToMany(Tag, { through: 'product_tag' });
        Tag.belongsToMany(Product, { through: 'product_tag' });
        Product.belongsTo(Tag, { as: 'Category' });
        Product.belongsTo(Company);

        Product.hasMany(Price);
        Price.belongsTo(Product);

        User.hasMany(GroupMember, { as: 'Memberships' });
        GroupMember.belongsTo(User);
        GroupMember.belongsTo(Rank);
        GroupMember.belongsTo(Group);
        Group.hasMany(GroupMember, { as: 'Memberships' });

        await this.sequelize.sync({ force: true });
        await Group.bulkCreate([
          { name: 'Developers' },
          { name: 'Designers' },
          { name: 'Managers' }
        ]);
        const groups = await Group.findAll();
        await Company.bulkCreate([
          { name: 'Sequelize' },
          { name: 'Coca Cola' },
          { name: 'Bonanza' },
          { name: 'NYSE' },
          { name: 'Coshopr' }
        ]);
        const companies = await Company.findAll();
        await Rank.bulkCreate([
          { name: 'Admin', canInvite: 1, canRemove: 1, canPost: 1 },
          { name: 'Trustee', canInvite: 1, canRemove: 0, canPost: 1 },
          { name: 'Member', canInvite: 1, canRemove: 0, canPost: 0 }
        ]);
        const ranks = await Rank.findAll();
        await Tag.bulkCreate([
          { name: 'A' },
          { name: 'B' },
          { name: 'C' },
          { name: 'D' },
          { name: 'E' }
        ]);
        const tags = await Tag.findAll();
        for (const i of [0, 1, 2, 3, 4]) {
          const user = await User.create();
          // Edited this part because a test expect id to be 3.
          // This maintains the test procedure, giving Product predictable ids.
          await Product.bulkCreate([
            { id: i * 5 + 1, title: 'Chair' },
            { id: i * 5 + 2, title: 'Desk' },
            { id: i * 5 + 3, title: 'Bed' },
            { id: i * 5 + 4, title: 'Pen' },
            { id: i * 5 + 5, title: 'Monitor' }
          ]);
          const products = await Product.findAll();
          const groupMembers  = [
            { AccUserId: user.id, GroupId: groups[0].id, RankId: ranks[0].id },
            { AccUserId: user.id, GroupId: groups[1].id, RankId: ranks[2].id }
          ];
          if (i < 3) {
            groupMembers.push({ AccUserId: user.id, GroupId: groups[2].id, RankId: ranks[1].id });
          }
          await Promise.all([
            GroupMember.bulkCreate(groupMembers),
            user.setProducts([
              products[i * 5 + 0],
              products[i * 5 + 1],
              products[i * 5 + 3]
            ]),
            products[i * 5 + 0].setTags([
              tags[0],
              tags[2]
            ]),
            products[i * 5 + 1].setTags([
              tags[1]
            ]),
            products[i * 5 + 0].setCategory(tags[1]),
            products[i * 5 + 2].setTags([
              tags[0]
            ]),
            products[i * 5 + 3].setTags([
              tags[0]
            ]),
            products[i * 5 + 0].setCompany(companies[4]),
            products[i * 5 + 1].setCompany(companies[3]),
            products[i * 5 + 2].setCompany(companies[2]),
            products[i * 5 + 3].setCompany(companies[1]),
            products[i * 5 + 4].setCompany(companies[0]),
            Price.bulkCreate([
              { ProductId: products[i * 5 + 0].id, value: 5 },
              { ProductId: products[i * 5 + 0].id, value: 10 },
              { ProductId: products[i * 5 + 1].id, value: 5 },
              { ProductId: products[i * 5 + 1].id, value: 10 },
              { ProductId: products[i * 5 + 1].id, value: 15 },
              { ProductId: products[i * 5 + 1].id, value: 20 },
              { ProductId: products[i * 5 + 2].id, value: 20 },
              { ProductId: products[i * 5 + 3].id, value: 20 }
            ])
          ]);
        }
      };
    });

    // Edit reason: This test originally fails because it expects ProductId = 3.
    // Edited beforeEach to give it predictable ids.
    // CRDB does not guarantee that a DB entry will have sequential ids, starting by 1.
    it('should be possible to select on columns inside a through table', async function() {
      await this.fixtureA();

      const products = await this.models.Product.findAll({
        attributes: ['title'],
        include: [
          {
            model: this.models.Tag,
            through: {
              where: {
                ProductId: 3
              }
            },
            required: true
          }
        ]
      });

      expect(products).have.length(1);
    });

    // Edit reason: This test originally fails because it expects ProductId = 3.
    // Edited beforeEach to give it predictable ids.
    // CRDB does not guarantee that a DB entry will have sequential ids, starting by 1.
    it('should be possible to select on columns inside a through table and a limit', async function() {
      await this.fixtureA();

      const products = await this.models.Product.findAll({
        attributes: ['title'],
        include: [
          {
            model: this.models.Tag,
            through: {
              where: {
                ProductId: 3
              }
            },
            required: true
          }
        ],
        limit: 5
      });

      expect(products).have.length(1);
    });
  });
});
