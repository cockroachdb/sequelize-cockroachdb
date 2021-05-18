require('./helper');

var expect = require('chai').expect;
var Sequelize = require('..');
var DataTypes = Sequelize.DataTypes;
var Op = Sequelize.Op;

describe('associations', () => {
  describe('scope', () => {
    beforeEach(function () {
      this.Post = this.sequelize.define('post', {});
      this.Image = this.sequelize.define('image', {});
      this.Question = this.sequelize.define('question', {});
      this.Comment = this.sequelize.define('comment', {
        title: Sequelize.STRING,
        type: Sequelize.STRING,
        commentable: Sequelize.STRING,
        commentable_id: Sequelize.INTEGER,
        isMain: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }
      });

      this.Comment.prototype.getItem = function () {
        return this[
          `get${this.get('commentable').substr(0, 1).toUpperCase()}${this.get(
            'commentable'
          ).substr(1)}`
        ]();
      };

      this.Post.addScope('withComments', {
        include: [this.Comment]
      });
      this.Post.addScope('withMainComment', {
        include: [
          {
            model: this.Comment,
            as: 'mainComment'
          }
        ]
      });
      this.Post.hasMany(this.Comment, {
        foreignKey: 'commentable_id',
        scope: {
          commentable: 'post'
        },
        constraints: false
      });
      this.Post.hasMany(this.Comment, {
        foreignKey: 'commentable_id',
        as: 'coloredComments',
        scope: {
          commentable: 'post',
          type: { [Op.in]: ['blue', 'green'] }
        },
        constraints: false
      });
      this.Post.hasOne(this.Comment, {
        foreignKey: 'commentable_id',
        as: 'mainComment',
        scope: {
          commentable: 'post',
          isMain: true
        },
        constraints: false
      });
      this.Comment.belongsTo(this.Post, {
        foreignKey: 'commentable_id',
        as: 'post',
        constraints: false
      });

      this.Image.hasMany(this.Comment, {
        foreignKey: 'commentable_id',
        scope: {
          commentable: 'image'
        },
        constraints: false
      });
      this.Comment.belongsTo(this.Image, {
        foreignKey: 'commentable_id',
        as: 'image',
        constraints: false
      });

      this.Question.hasMany(this.Comment, {
        foreignKey: 'commentable_id',
        scope: {
          commentable: 'question'
        },
        constraints: false
      });
      this.Comment.belongsTo(this.Question, {
        foreignKey: 'commentable_id',
        as: 'question',
        constraints: false
      });
    });

    describe('N:M', () => {
      // Reason: Scope association fails when using UUID
      // https://github.com/sequelize/sequelize/issues/13072
      describe.skip('on the through model', () => {
        beforeEach(function () {
          this.Post = this.sequelize.define('post', {});
          this.Image = this.sequelize.define('image', {});
          this.Question = this.sequelize.define('question', {});

          this.ItemTag = this.sequelize.define('item_tag', {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true
            },
            tag_id: {
              type: DataTypes.INTEGER,
              unique: 'item_tag_taggable'
            },
            taggable: {
              type: DataTypes.STRING,
              unique: 'item_tag_taggable'
            },
            taggable_id: {
              type: DataTypes.INTEGER,
              unique: 'item_tag_taggable',
              references: null
            }
          });
          this.Tag = this.sequelize.define('tag', {
            name: DataTypes.STRING
          });

          this.Post.belongsToMany(this.Tag, {
            through: {
              model: this.ItemTag,
              unique: false,
              scope: {
                taggable: 'post'
              }
            },
            foreignKey: 'taggable_id',
            constraints: false
          });
          this.Tag.belongsToMany(this.Post, {
            through: {
              model: this.ItemTag,
              unique: false
            },
            foreignKey: 'tag_id'
          });

          this.Image.belongsToMany(this.Tag, {
            through: {
              model: this.ItemTag,
              unique: false,
              scope: {
                taggable: 'image'
              }
            },
            foreignKey: 'taggable_id',
            constraints: false
          });
          this.Tag.belongsToMany(this.Image, {
            through: {
              model: this.ItemTag,
              unique: false
            },
            foreignKey: 'tag_id'
          });

          this.Question.belongsToMany(this.Tag, {
            through: {
              model: this.ItemTag,
              unique: false,
              scope: {
                taggable: 'question'
              }
            },
            foreignKey: 'taggable_id',
            constraints: false
          });
          this.Tag.belongsToMany(this.Question, {
            through: {
              model: this.ItemTag,
              unique: false
            },
            foreignKey: 'tag_id'
          });
        });

        it('should create, find and include associations with scope values', async function () {
          await Promise.all([
            this.Post.sync({ force: true }),
            this.Image.sync({ force: true }),
            this.Question.sync({ force: true }),
            this.Tag.sync({ force: true })
          ]);

          await this.ItemTag.sync({ force: true });

          const [
            post0,
            image0,
            question0,
            tagA,
            tagB,
            tagC
          ] = await Promise.all([
            this.Post.create(),
            this.Image.create(),
            this.Question.create(),
            this.Tag.create({ name: 'tagA' }),
            this.Tag.create({ name: 'tagB' }),
            this.Tag.create({ name: 'tagC' })
          ]);

          this.post = post0;
          this.image = image0;
          this.question = question0;

          await Promise.all([
            post0.setTags([tagA]).then(async () => {
              return Promise.all([
                post0.createTag({ name: 'postTag' }),
                post0.addTag(tagB)
              ]);
            }),
            image0.setTags([tagB]).then(async () => {
              return Promise.all([
                image0.createTag({ name: 'imageTag' }),
                image0.addTag(tagC)
              ]);
            }),
            question0.setTags([tagC]).then(async () => {
              return Promise.all([
                question0.createTag({ name: 'questionTag' }),
                question0.addTag(tagA)
              ]);
            })
          ]);

          const [postTags, imageTags, questionTags] = await Promise.all([
            this.post.getTags(),
            this.image.getTags(),
            this.question.getTags()
          ]);
          expect(postTags.length).to.equal(3);
          expect(imageTags.length).to.equal(3);
          expect(questionTags.length).to.equal(3);

          expect(
            postTags
              .map(tag => {
                return tag.name;
              })
              .sort()
          ).to.deep.equal(['postTag', 'tagA', 'tagB']);

          expect(
            imageTags
              .map(tag => {
                return tag.name;
              })
              .sort()
          ).to.deep.equal(['imageTag', 'tagB', 'tagC']);

          expect(
            questionTags
              .map(tag => {
                return tag.name;
              })
              .sort()
          ).to.deep.equal(['questionTag', 'tagA', 'tagC']);

          const [post, image, question] = await Promise.all([
            this.Post.findOne({
              where: {},
              include: [this.Tag]
            }),
            this.Image.findOne({
              where: {},
              include: [this.Tag]
            }),
            this.Question.findOne({
              where: {},
              include: [this.Tag]
            })
          ]);

          expect(post.tags.length).to.equal(3);
          expect(image.tags.length).to.equal(3);
          expect(question.tags.length).to.equal(3);

          expect(
            post.tags
              .map(tag => {
                return tag.name;
              })
              .sort()
          ).to.deep.equal(['postTag', 'tagA', 'tagB']);

          expect(
            image.tags
              .map(tag => {
                return tag.name;
              })
              .sort()
          ).to.deep.equal(['imageTag', 'tagB', 'tagC']);

          expect(
            question.tags
              .map(tag => {
                return tag.name;
              })
              .sort()
          ).to.deep.equal(['questionTag', 'tagA', 'tagC']);
        });
      });
    });
  });
});
