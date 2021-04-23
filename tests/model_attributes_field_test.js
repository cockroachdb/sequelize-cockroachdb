'use strict';

require('./helper');

const sinon = require('sinon'),
  { DataTypes } = require('../source');

describe('Model', () => {
  before(function() {
    this.clock = sinon.useFakeTimers();
  });

  after(function() {
    this.clock.restore();
  });

  describe('attributes', () => {
    describe('field', () => {
      beforeEach(async function() {
        const queryInterface = this.sequelize.getQueryInterface();

        this.User = this.sequelize.define('user', {
          id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            field: 'userId'
          },
          name: {
            type: DataTypes.STRING,
            field: 'full_name'
          },
          taskCount: {
            type: DataTypes.INTEGER,
            field: 'task_count',
            defaultValue: 0,
            allowNull: false
          }
        }, {
          tableName: 'users',
          timestamps: false
        });

        this.Task = this.sequelize.define('task', {
          id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            field: 'taskId'
          },
          title: {
            type: DataTypes.STRING,
            field: 'name'
          }
        }, {
          tableName: 'tasks',
          timestamps: false
        });

        this.Comment = this.sequelize.define('comment', {
          id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            field: 'commentId'
          },
          text: { type: DataTypes.STRING, field: 'comment_text' },
          notes: { type: DataTypes.STRING, field: 'notes' },
          likes: { type: DataTypes.INTEGER, field: 'like_count' },
          createdAt: { type: DataTypes.DATE, field: 'created_at', allowNull: false },
          updatedAt: { type: DataTypes.DATE, field: 'updated_at', allowNull: false }
        }, {
          tableName: 'comments',
          timestamps: true
        });

        this.User.hasMany(this.Task, {
          foreignKey: 'user_id'
        });
        this.Task.belongsTo(this.User, {
          foreignKey: 'user_id'
        });
        this.Task.hasMany(this.Comment, {
          foreignKey: 'task_id'
        });
        this.Comment.belongsTo(this.Task, {
          foreignKey: 'task_id'
        });

        this.User.belongsToMany(this.Comment, {
          foreignKey: 'userId',
          otherKey: 'commentId',
          through: 'userComments'
        });

        await Promise.all([
          queryInterface.createTable('users', {
            userId: {
              type: DataTypes.INTEGER,
              allowNull: false,
              primaryKey: true,
              autoIncrement: true
            },
            full_name: {
              type: DataTypes.STRING
            },
            task_count: {
              type: DataTypes.INTEGER,
              allowNull: false,
              defaultValue: 0
            }
          }),
          queryInterface.createTable('tasks', {
            taskId: {
              type: DataTypes.INTEGER,
              allowNull: false,
              primaryKey: true,
              autoIncrement: true
            },
            user_id: {
              type: DataTypes.INTEGER
            },
            name: {
              type: DataTypes.STRING
            }
          }),
          queryInterface.createTable('comments', {
            commentId: {
              type: DataTypes.INTEGER,
              allowNull: false,
              primaryKey: true,
              autoIncrement: true
            },
            task_id: {
              type: DataTypes.INTEGER
            },
            comment_text: {
              type: DataTypes.STRING
            },
            notes: {
              type: DataTypes.STRING
            },
            like_count: {
              type: DataTypes.INTEGER
            },
            created_at: {
              type: DataTypes.DATE,
              allowNull: false
            },
            updated_at: {
              type: DataTypes.DATE
            }
          }),
          queryInterface.createTable('userComments', {
            commentId: {
              type: DataTypes.INTEGER
            },
            userId: {
              type: DataTypes.INTEGER
            }
          })
        ]);
      });

      describe('field and attribute name is the same', () => {
        beforeEach(async function() {
          await this.Comment.bulkCreate([
            // Added ids to Comment
            { id: 1, notes: 'Number one' },
            { id: 2, notes: 'Number two' }
          ]);
        });
        // Edited beforeEach of this test since it looks for Pk 1, and it's not guaranteed id will be 1.
        it('reload should work', async function() {
          const comment = await this.Comment.findByPk(1);
          await comment.reload();
        });
      });
    });
  });
});