'use strict';

require('./helper');

const { expect } = require('chai'),
  { Sequelize, DataTypes } = require('../source');

const Support = {
  // Copied from helper, to attend to a specific Sequelize instance creation.
  createSequelizeInstance: options => {
    return new Sequelize('sequelize_test', 'root', '', {
      dialect: 'postgres',
      port: process.env.COCKROACH_PORT || 26257,
      logging: false,
      typeValidation: true,
      minifyAliases: options.minifyAliases || false
    });
  }
};

describe('[POSTGRES] Query', function () {
  const taskAlias =
    'AnActualVeryLongAliasThatShouldBreakthePostgresLimitOfSixtyFourCharacters';
  const teamAlias = 'Toto';

  const executeTest = async function (options, test) {
    const sequelize = Support.createSequelizeInstance(options);

    const User = sequelize.define(
      'User',
      { name: DataTypes.STRING, updatedAt: DataTypes.DATE },
      { underscored: true }
    );
    const Team = sequelize.define('Team', { name: DataTypes.STRING });
    const Task = sequelize.define('Task', { title: DataTypes.STRING });

    User.belongsTo(Task, { as: taskAlias, foreignKey: 'task_id' });
    User.belongsToMany(Team, {
      as: teamAlias,
      foreignKey: 'teamId',
      through: 'UserTeam'
    });
    Team.belongsToMany(User, { foreignKey: 'userId', through: 'UserTeam' });

    await sequelize.sync({ force: true });
    const team = await Team.create({ name: 'rocket' });
    const task = await Task.create({ title: 'SuperTask' });
    const user = await User.create({
      name: 'test',
      task_id: task.id,
      updatedAt: new Date()
    });
    await user[`add${teamAlias}`](team);

    return test(
      await User.findOne({
        include: [
          {
            model: Task,
            as: taskAlias
          },
          {
            model: Team,
            as: teamAlias
          }
        ]
      })
    );
  };

  // Skip reason: CRDB does support identifiers longer than 64 characters.
  it.skip('should throw due to alias being truncated', async function () {
    const options = { ...this.sequelize.options, minifyAliases: false };

    await executeTest(options, res => {
      expect(res[taskAlias]).to.not.exist;
    });
  });
});
