'use strict';

require('./helper');

const { expect } = require('chai');
const sinon = require('sinon');
const { DataTypes, Sequelize } = require('../source');
const _ = require('lodash');

describe('Model', () => {
  describe('findAll', () => {
    describe('groupedLimit', () => {
      before(function() {
        this.clock = sinon.useFakeTimers();
      });

      afterEach(function() {
        this.clock.reset();
      });

      after(function() {
        this.clock.restore();
      });

      beforeEach(async function() {
        this.User = this.sequelize.define('user', {
          age: Sequelize.INTEGER,
          // Added this position field to make a sequential marker.
          position: Sequelize.INTEGER
        });
        this.Project = this.sequelize.define('project', {
          title: DataTypes.STRING
        });
        this.Task = this.sequelize.define('task');

        this.ProjectUserParanoid = this.sequelize.define('project_user_paranoid', {}, {
          timestamps: true,
          paranoid: true,
          createdAt: false,
          updatedAt: false
        });

        this.User.Projects = this.User.belongsToMany(this.Project, { through: 'project_user' });
        this.Project.belongsToMany(this.User, { as: 'members', through: 'project_user' });

        this.User.ParanoidProjects = this.User.belongsToMany(this.Project, { through: this.ProjectUserParanoid });
        this.Project.belongsToMany(this.User, { as: 'paranoidMembers', through: this.ProjectUserParanoid });

        this.User.Tasks = this.User.hasMany(this.Task);

        await this.sequelize.sync({ force: true });

        await Promise.all([
          this.User.bulkCreate([
            { age: -5, position: 1 }, 
            { age: 45, position: 2 }, 
            { age: 7,  position: 3 },
            { age: -9, position: 4 },
            { age: 8,  position: 5 },
            { age: 15, position: 6 },
            { age: -9, position: 7 }]),
          this.Project.bulkCreate([{}, {}]),
          this.Task.bulkCreate([{}, {}])
        ]);

        const [users, projects, tasks] = await Promise.all([this.User.findAll(), this.Project.findAll(), this.Task.findAll()]);
        this.projects = projects;

        await Promise.all([
          projects[0].setMembers(users.slice(0, 4)),
          projects[1].setMembers(users.slice(2)),
          projects[0].setParanoidMembers(users.slice(0, 4)),
          projects[1].setParanoidMembers(users.slice(2)),
          users[2].setTasks(tasks)
        ]);
      });

      describe('on: belongsToMany', () => {
        // Reason: CRDB does not generate gapless incremental ids.
        // Reimplementing below.
        it.skip('maps attributes from a grouped limit to models', async function() {
          const users = await this.User.findAll({
            groupedLimit: {
              limit: 3,
              on: this.User.Projects,
              values: this.projects.map(item => item.get('id'))
            }
          });

          expect(users).to.have.length(5);
          users.filter(u => u.get('id') !== 3).forEach(u => {
            expect(u.get('projects')).to.have.length(1);
          });
          users.filter(u => u.get('id') === 3).forEach(u => {
            expect(u.get('projects')).to.have.length(2);
          });
        });
        it('maps attributes from a grouped limit to models', async function() {
          const users = await this.User.findAll({
            groupedLimit: {
              limit: 3,
              on: this.User.Projects,
              values: this.projects.map(item => item.get('id'))
            }
          });

          expect(users).to.have.length(5);
          users.filter(u => u.get('id') !== users[2].id).forEach(u => {
            expect(u.get('projects')).to.have.length(1);
          });
          users.filter(u => u.get('id') === users[2].id).forEach(u => {
            expect(u.get('projects')).to.have.length(2);
          });
        });

        // Reason: CRDB does not generate gapless incremental ids.
        // Reimplementing below.
        it.skip('maps attributes from a grouped limit to models with include', async function() {
          const users = await this.User.findAll({
            groupedLimit: {
              limit: 3,
              on: this.User.Projects,
              values: this.projects.map(item => item.get('id'))
            },
            order: ['id'],
            include: [this.User.Tasks]
          });

          /*
           project1 - 1, 2, 3
           project2 - 3, 4, 5
           */
          expect(users).to.have.length(5);
          expect(users.map(u => u.get('id'))).to.deep.equal([1, 2, 3, 4, 5]);

          expect(users[2].get('tasks')).to.have.length(2);
          users.filter(u => u.get('id') !== 3).forEach(u => {
            expect(u.get('projects')).to.have.length(1);
          });
          users.filter(u => u.get('id') === 3).forEach(u => {
            expect(u.get('projects')).to.have.length(2);
          });
        });
        it('maps attributes from a grouped limit to models with include', async function() {
          const users = await this.User.findAll({
            groupedLimit: {
              limit: 3,
              on: this.User.Projects,
              values: this.projects.map(item => item.get('id'))
            },
            order: ['id'],
            include: [this.User.Tasks]
          });

          /*
           project1 - 1, 2, 3
           project2 - 3, 4, 5
           */
          expect(users).to.have.length(5);

          expect(users[2].get('tasks')).to.have.length(2);
          users.filter(u => u.get('id') !== users[2].id).forEach(u => {
            expect(u.get('projects')).to.have.length(1);
          });
          users.filter(u => u.get('id') === users[2].id).forEach(u => {
            expect(u.get('projects')).to.have.length(2);
          });
        });

        // Edited test. It relays on a sequential field. 
        // To keep its essence, added a new field to User.
        it('works with computed order', async function() {
          const users = await this.User.findAll({
            attributes: ['id', 'position'],
            groupedLimit: {
              limit: 3,
              on: this.User.Projects,
              values: this.projects.map(item => item.get('id'))
            },
            order: [
              Sequelize.fn('ABS', Sequelize.col('age'))
            ],
            include: [this.User.Tasks]
          });

          /*
           project1 - 1, 3, 4
           project2 - 3, 5, 4
         */
          expect(users).to.have.length(4);
          // Changed get('id') to get('position')
          expect(users.map(u => u.get('position'))).to.deep.equal([1, 3, 5, 4]);
        });

        // Edited test. It relays on a sequential field. 
        // To keep its essence, added a new field to User.
        it('works with multiple orders', async function() {
          const users = await this.User.findAll({
            attributes: ['id', 'position'],
            groupedLimit: {
              limit: 3,
              on: this.User.Projects,
              values: this.projects.map(item => item.get('id'))
            },
            order: [
              Sequelize.fn('ABS', Sequelize.col('age')),
              ['id', 'DESC']
            ],
            include: [this.User.Tasks]
          });

          /*
            project1 - 1, 3, 4
            project2 - 3, 5, 7
           */
          expect(users).to.have.length(5);
          // Changed get('id') to get('position')
          expect(users.map(u => u.get('position'))).to.deep.equal([1, 3, 5, 7, 4]);
        });

        // Edited test. It relays on a sequential field. 
        // To keep its essence, added a new field to User.
        it('works with paranoid junction models', async function() {
          const users0 = await this.User.findAll({
            attributes: ['id', 'position'],
            groupedLimit: {
              limit: 3,
              on: this.User.ParanoidProjects,
              values: this.projects.map(item => item.get('id'))
            },
            order: [
              Sequelize.fn('ABS', Sequelize.col('age')),
              ['id', 'DESC']
            ],
            include: [this.User.Tasks]
          });

          /*
            project1 - 1, 3, 4
            project2 - 3, 5, 7
           */
          expect(users0).to.have.length(5);
          // Changed get('id') to get('position')
          expect(users0.map(u => u.get('position'))).to.deep.equal([1, 3, 5, 7, 4]);

          await Promise.all([
            this.projects[0].setParanoidMembers(users0.slice(0, 2)),
            this.projects[1].setParanoidMembers(users0.slice(4))
          ]);

          const users = await this.User.findAll({
            attributes: ['id', 'position'],
            groupedLimit: {
              limit: 3,
              on: this.User.ParanoidProjects,
              values: this.projects.map(item => item.get('id'))
            },
            order: [
              Sequelize.fn('ABS', Sequelize.col('age')),
              ['id', 'DESC']
            ],
            include: [this.User.Tasks]
          });

          /*
            project1 - 1, 3
            project2 - 4
           */
          expect(users).to.have.length(3);
          // Changed get('id') to get('position')
          expect(users.map(u => u.get('position'))).to.deep.equal([1, 3, 4]);
        });
      });

      describe('on: hasMany', () => {
        beforeEach(async function() {
          this.User = this.sequelize.define('user');
          this.Task = this.sequelize.define('task');
          this.User.Tasks = this.User.hasMany(this.Task);

          await this.sequelize.sync({ force: true });

          await Promise.all([
            this.User.bulkCreate([{}, {}, {}]),
            this.Task.bulkCreate([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }])
          ]);

          const [users, tasks] = await Promise.all([this.User.findAll(), this.Task.findAll()]);
          this.users = users;

          await Promise.all([
            users[0].setTasks(tasks[0]),
            users[1].setTasks(tasks.slice(1, 4)),
            users[2].setTasks(tasks.slice(4))
          ]);
        });

        // Reason: CRDB does not generate gapless incremental ids.
        // Reimplementing below.
        it.skip('Applies limit and order correctly', async function() {
          const tasks = await this.Task.findAll({
            order: [
              ['id', 'DESC']
            ],
            groupedLimit: {
              limit: 3,
              on: this.User.Tasks,
              values: this.users.map(item => item.get('id'))
            }
          });

          const byUser = _.groupBy(tasks, _.property('userId'));
          expect(Object.keys(byUser)).to.have.length(3);
          console.log(byUser);
          expect(byUser[1]).to.have.length(1);
          expect(byUser[2]).to.have.length(3);
          expect(_.invokeMap(byUser[2], 'get', 'id')).to.deep.equal([4, 3, 2]);
          expect(byUser[3]).to.have.length(2);
        });
        it('Applies limit and order correctly', async function() {
          const tasks = await this.Task.findAll({
            order: [
              ['id', 'DESC']
            ],
            groupedLimit: {
              limit: 3,
              on: this.User.Tasks,
              values: this.users.map(item => item.get('id'))
            }
          });

          const byUser = _.groupBy(tasks, _.property('userId'));
          const userKeys = Object.keys(byUser);

          expect(userKeys).to.have.length(3);
          
          expect(byUser[userKeys[0]]).to.have.length(1);
          expect(byUser[userKeys[1]]).to.have.length(3);
          expect(_.invokeMap(byUser[userKeys[1]], 'get', 'id')).to.deep.equal([4, 3, 2]);
          expect(byUser[userKeys[2]]).to.have.length(2);
        });
      });
    });
  });
});