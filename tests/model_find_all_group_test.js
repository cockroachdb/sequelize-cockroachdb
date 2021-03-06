'use strict';

require('./helper');

const { expect } = require('chai');
const { Sequelize, DataTypes } = require('../source');

describe('Model', () => {
  describe('findAll', () => {
    describe('group', () => {
      it('should correctly group with attributes, #3009', async function () {
        const Post = this.sequelize.define('Post', {
          id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
          },
          name: { type: DataTypes.STRING, allowNull: false }
        });

        const Comment = this.sequelize.define('Comment', {
          id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
          },
          text: { type: DataTypes.STRING, allowNull: false }
        });

        Post.hasMany(Comment);

        await this.sequelize.sync({ force: true });

        // CRDB does not give human readable ids, it's usually a Big Number.
        // Also, autoIncrement does not guarantee sequentially incremented numbers.
        // Had to ensure ids are 1 and 2 for this test.
        await Post.bulkCreate([
          { id: 1, name: 'post-1' },
          { id: 2, name: 'post-2' }
        ]);

        await Comment.bulkCreate([
          { text: 'Market', PostId: 1 },
          { text: 'Text', PostId: 2 },
          { text: 'Abc', PostId: 2 },
          { text: 'Semaphor', PostId: 1 },
          { text: 'Text', PostId: 1 }
        ]);

        const posts = await Post.findAll({
          attributes: [
            [
              Sequelize.fn('COUNT', Sequelize.col('Comments.id')),
              'comment_count'
            ]
          ],
          include: [{ model: Comment, attributes: [] }],
          group: ['Post.id'],
          order: [['id']]
        });

        expect(parseInt(posts[0].get('comment_count'), 10)).to.be.equal(3);
        expect(parseInt(posts[1].get('comment_count'), 10)).to.be.equal(2);
      });

      it('should not add primary key when grouping using a belongsTo association', async function () {
        const Post = this.sequelize.define('Post', {
          id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
          },
          name: { type: DataTypes.STRING, allowNull: false }
        });

        const Comment = this.sequelize.define('Comment', {
          id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
          },
          text: { type: DataTypes.STRING, allowNull: false }
        });

        Post.hasMany(Comment);
        Comment.belongsTo(Post);

        await this.sequelize.sync({ force: true });

        // CRDB does not give human readable ids, it's usually a Big Number.
        // Also, autoIncrement does not guarantee sequentially incremented numbers.
        // Had to ensure ids are 1 and 2 for this test.
        await Post.bulkCreate([
          { id: 1, name: 'post-1' },
          { id: 2, name: 'post-2' }
        ]);

        await Comment.bulkCreate([
          { text: 'Market', PostId: 1 },
          { text: 'Text', PostId: 2 },
          { text: 'Abc', PostId: 2 },
          { text: 'Semaphor', PostId: 1 },
          { text: 'Text', PostId: 1 }
        ]);

        const posts = await Comment.findAll({
          attributes: [
            'PostId',
            [
              Sequelize.fn('COUNT', Sequelize.col('Comment.id')),
              'comment_count'
            ]
          ],
          include: [{ model: Post, attributes: [] }],
          group: ['PostId'],
          order: [['PostId']]
        });

        expect(posts[0].get().hasOwnProperty('id')).to.equal(false);
        expect(posts[1].get().hasOwnProperty('id')).to.equal(false);
        expect(parseInt(posts[0].get('comment_count'), 10)).to.be.equal(3);
        expect(parseInt(posts[1].get('comment_count'), 10)).to.be.equal(2);
      });
    });
  });
});
