'use strict';

require('./helper');

const { expect } = require('chai'),
  { DataTypes, Sequelize } = require('../source'),
  sinon = require('sinon'),
  Op = Sequelize.Op;

describe('Include', () => {
  before(function() {
    this.clock = sinon.useFakeTimers();
  });

  after(function() {
    this.clock.restore();
  });

  describe('findAndCountAll', () => {

    // Edited test. Reason: CRDB does not guarantee sequential ids. This test relies on predictable ids.
    it('should be able to include a required model. Result rows should match count', async function() {
      const User = this.sequelize.define('User', { name: DataTypes.STRING(40) }, { paranoid: true }),
        SomeConnection = this.sequelize.define('SomeConnection', {
          m: DataTypes.STRING(40),
          fk: DataTypes.INTEGER,
          u: DataTypes.INTEGER
        }, { paranoid: true }),
        A = this.sequelize.define('A', { name: DataTypes.STRING(40) }, { paranoid: true }),
        B = this.sequelize.define('B', { name: DataTypes.STRING(40) }, { paranoid: true }),
        C = this.sequelize.define('C', { name: DataTypes.STRING(40) }, { paranoid: true });

      // Associate them
      User.hasMany(SomeConnection, { foreignKey: 'u', constraints: false });

      SomeConnection.belongsTo(User, { foreignKey: 'u', constraints: false });
      SomeConnection.belongsTo(A, { foreignKey: 'fk', constraints: false });
      SomeConnection.belongsTo(B, { foreignKey: 'fk', constraints: false });
      SomeConnection.belongsTo(C, { foreignKey: 'fk', constraints: false });

      A.hasMany(SomeConnection, { foreignKey: 'fk', constraints: false });
      B.hasMany(SomeConnection, { foreignKey: 'fk', constraints: false });
      C.hasMany(SomeConnection, { foreignKey: 'fk', constraints: false });

      // Sync them
      await this.sequelize.sync({ force: true });

      // Create an enviroment

      await Promise.all([User.bulkCreate([
        // This part differs from original Sequelize test.
        // Added sequential ids to creation because of Association expectation.
        { id: 1, name: 'Youtube' },
        { id: 2, name: 'Facebook' },
        { id: 3, name: 'Google' },
        { id: 4, name: 'Yahoo' },
        { id: 5, name: '404' }
      ]), SomeConnection.bulkCreate([ // Lets count, m: A and u: 1
        { u: 1, m: 'A', fk: 1 }, // 1  // Will be deleted
        { u: 2, m: 'A', fk: 1 },
        { u: 3, m: 'A', fk: 1 },
        { u: 4, m: 'A', fk: 1 },
        { u: 5, m: 'A', fk: 1 },
        { u: 1, m: 'B', fk: 1 },
        { u: 2, m: 'B', fk: 1 },
        { u: 3, m: 'B', fk: 1 },
        { u: 4, m: 'B', fk: 1 },
        { u: 5, m: 'B', fk: 1 },
        { u: 1, m: 'C', fk: 1 },
        { u: 2, m: 'C', fk: 1 },
        { u: 3, m: 'C', fk: 1 },
        { u: 4, m: 'C', fk: 1 },
        { u: 5, m: 'C', fk: 1 },
        { u: 1, m: 'A', fk: 2 }, // 2 // Will be deleted
        { u: 4, m: 'A', fk: 2 },
        { u: 2, m: 'A', fk: 2 },
        { u: 1, m: 'A', fk: 3 }, // 3
        { u: 2, m: 'A', fk: 3 },
        { u: 3, m: 'A', fk: 3 },
        { u: 2, m: 'B', fk: 2 },
        { u: 1, m: 'A', fk: 4 }, // 4
        { u: 4, m: 'A', fk: 2 }
      ]), A.bulkCreate([
        // This part differs from original Sequelize test.
        // Added sequential ids to creation because of Association expectation.
        { id: 1, name: 'Just' },
        { id: 2, name: 'for' },
        { id: 3, name: 'testing' },
        { id: 4, name: 'proposes' },
        { id: 5, name: 'only' }
      ]), B.bulkCreate([
        { name: 'this should not' },
        { name: 'be loaded' }
      ]), C.bulkCreate([
        { name: 'because we only want A' }
      ])]);

      // Delete some of conns to prove the concept
      await SomeConnection.destroy({ where: {
        m: 'A',
        u: 1,
        fk: [1, 2]
      } });

      this.clock.tick(1000);

      // Last and most important queries ( we connected 4, but deleted 2, witch means we must get 2 only )
      const result = await A.findAndCountAll({
        include: [{
          model: SomeConnection, required: true,
          where: {
            m: 'A', // Pseudo Polymorphy
            u: 1
          }
        }],
        limit: 5
      });

      expect(result.count).to.be.equal(2);
      expect(result.rows.length).to.be.equal(2);
    });

    // Edited test. Reason: CRDB does not guarantee sequential ids. This test relies on predictable ids.
    it('should correctly filter, limit and sort when multiple includes and types of associations are present.', async function() {
      const TaskTag = this.sequelize.define('TaskTag', {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING }
      });

      const Tag = this.sequelize.define('Tag', {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING }
      });

      const Task = this.sequelize.define('Task', {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING }
      });
      const Project = this.sequelize.define('Project', {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
        m: { type: DataTypes.STRING }
      });

      const User = this.sequelize.define('User', {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING }
      });

      Project.belongsTo(User);
      Task.belongsTo(Project);
      Task.belongsToMany(Tag, { through: TaskTag });

      // Sync them
      await this.sequelize.sync({ force: true });

      // Create an enviroment
      await User.bulkCreate([
        // This part differs from original Sequelize test.
        // Added sequential ids to creation because of Association expectation.
        { id: 1, name: 'user-name-1' },
        { id: 2, name: 'user-name-2' }
      ]);

      await Project.bulkCreate([
        // This part differs from original Sequelize test.
        // Added sequential ids to creation because of Association expectation.
        { id: 1, m: 'A', UserId: 1 },
        { id: 2, m: 'A', UserId: 2 }
      ]);

      await Task.bulkCreate([
        { ProjectId: 1, name: 'Just' },
        { ProjectId: 1, name: 'for' },
        { ProjectId: 2, name: 'testing' },
        { ProjectId: 2, name: 'proposes' }
      ]);

      // Find All Tasks with Project(m=a) and User(name=user-name-2)
      const result = await Task.findAndCountAll({
        limit: 1,
        offset: 0,
        order: [['id', 'DESC']],
        include: [
          {
            model: Project,
            where: { [Op.and]: [{ m: 'A' }] },
            include: [{
              model: User,
              where: { [Op.and]: [{ name: 'user-name-2' }] }
            }
            ]
          },
          { model: Tag }
        ]
      });

      expect(result.count).to.equal(2);
      expect(result.rows.length).to.equal(1);
    });

    // Edited test. Reason: CRDB does not guarantee sequential ids. This test relies on predictable ids.
    it('should properly work with sequelize.function', async function() {
      const sequelize = this.sequelize;
      const User = this.sequelize.define('User', {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
        first_name: { type: DataTypes.STRING },
        last_name: { type: DataTypes.STRING }
      });

      const Project = this.sequelize.define('Project', {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING }
      });

      User.hasMany(Project);

      await this.sequelize.sync({ force: true });

      await User.bulkCreate([
        // This part differs from original Sequelize test.
        // Added sequential ids to creation because of Association expectation.
        { id: 1, first_name: 'user-fname-1', last_name: 'user-lname-1' },
        { id: 2, first_name: 'user-fname-2', last_name: 'user-lname-2' },
        { id: 3, first_name: 'user-xfname-1', last_name: 'user-xlname-1' }
      ]);

      await Project.bulkCreate([
        { name: 'naam-satya', UserId: 1 },
        { name: 'guru-satya', UserId: 2 },
        { name: 'app-satya', UserId: 2 }
      ]);

      const result = await User.findAndCountAll({
        limit: 1,
        offset: 1,
        where: sequelize.or(
          { first_name: { [Op.like]: '%user-fname%' } },
          { last_name: { [Op.like]: '%user-lname%' } }
        ),
        include: [
          {
            model: Project,
            required: true,
            where: { name: {
              [Op.in]: ['naam-satya', 'guru-satya']
            } }
          }
        ]
      });

      expect(result.count).to.equal(2);
      expect(result.rows.length).to.equal(1);
    });
  });
});
