require('./helper');

var expect = require('chai').expect;
var Sequelize = require('..');
var DataTypes = Sequelize.DataTypes;

var Support = {
  async dropTestSchemas(sequelize) {
    const queryInterface = sequelize.getQueryInterface();
    if (!queryInterface.queryGenerator._dialect.supports.schemas) {
      return this.sequelize.drop({});
    }

    const schemas = await sequelize.showAllSchemas();
    const schemasPromise = [];
    schemas.forEach(schema => {
      const schemaName = schema.name ? schema.name : schema;
      if (schemaName !== sequelize.config.database) {
        schemasPromise.push(sequelize.dropSchema(schemaName));
      }
    });

    await Promise.all(schemasPromise.map(p => p.catch(e => e)));
  },
}

describe('HasMany', () => {
  describe('get', () => {
    describe('multiple', () => {
      // Query result are non-deterministic
      // Reason: https://github.com/sequelize/sequelize/issues/13088
      it.skip('should fetch associations for multiple instances with limit and order and a belongsTo relation', async function() {
        const User = this.sequelize.define('User', {}),
          Task = this.sequelize.define('Task', {
            title: DataTypes.STRING,
            categoryId: {
              type: DataTypes.INTEGER,
              field: 'category_id'
            }
          }),
          Category = this.sequelize.define('Category', {});

        User.Tasks = User.hasMany(Task, { as: 'tasks' });
        Task.Category = Task.belongsTo(Category, { as: 'category', foreignKey: 'categoryId' });

        await this.sequelize.sync({ force: true });

        const users = await Promise.all([User.create({
          tasks: [
            { title: 'b', category: {} },
            { title: 'd', category: {} },
            { title: 'c', category: {} },
            { title: 'a', category: {} }
          ]
        }, {
          include: [{ association: User.Tasks, include: [Task.Category] }]
        }), User.create({
          tasks: [
            { title: 'a', category: {} },
            { title: 'c', category: {} },
            { title: 'b', category: {} }
          ]
        }, {
          include: [{ association: User.Tasks, include: [Task.Category] }]
        })]);

        const result = await User.Tasks.get(users, {
          limit: 2,
          order: [
            ['title', 'ASC']
          ],
          include: [Task.Category]
        });

        expect(result[users[0].id].length).to.equal(2);
        expect(result[users[0].id][0].title).to.equal('a');
        expect(result[users[0].id][0].category).to.be.ok;
        expect(result[users[0].id][1].title).to.equal('b');
        expect(result[users[0].id][1].category).to.be.ok;

        expect(result[users[1].id].length).to.equal(2);
        expect(result[users[1].id][0].title).to.equal('a');
        expect(result[users[1].id][0].category).to.be.ok;
        expect(result[users[1].id][1].title).to.equal('b');
        expect(result[users[1].id][1].category).to.be.ok;
      });

      // Reason: works correctly, but it fails because it tries to drop table crdb_internal from cockroach
      it.skip('supports schemas', async function() {
        const User = this.sequelize.define('User', {}).schema('work'),
          Task = this.sequelize.define('Task', {
            title: DataTypes.STRING
          }).schema('work'),
          SubTask = this.sequelize.define('SubTask', {
            title: DataTypes.STRING
          }).schema('work');

        User.Tasks = User.hasMany(Task, { as: 'tasks' });
        Task.SubTasks = Task.hasMany(SubTask, { as: 'subtasks' });

        await Support.dropTestSchemas(this.sequelize);
        await this.sequelize.createSchema('work');
        await User.sync({ force: true });
        await Task.sync({ force: true });
        await SubTask.sync({ force: true });

        await Promise.all([User.create({
          id: 1,
          tasks: [
            {
              title: 'b', subtasks: [
                { title: 'c' },
                { title: 'a' }
              ]
            },
            { title: 'd' },
            {
              title: 'c', subtasks: [
                { title: 'b' },
                { title: 'a' },
                { title: 'c' }
              ]
            },
            {
              title: 'a', subtasks: [
                { title: 'c' },
                { title: 'a' },
                { title: 'b' }
              ]
            }
          ]
        }, {
          include: [{ association: User.Tasks, include: [Task.SubTasks] }]
        }), User.create({
          id: 2,
          tasks: [
            {
              title: 'a', subtasks: [
                { title: 'b' },
                { title: 'a' },
                { title: 'c' }
              ]
            },
            {
              title: 'c', subtasks: [
                { title: 'a' }
              ]
            },
            {
              title: 'b', subtasks: [
                { title: 'a' },
                { title: 'b' }
              ]
            }
          ]
        }, {
          include: [{ association: User.Tasks, include: [Task.SubTasks] }]
        })]);

        const users = await User.findAll({
          include: [{
            association: User.Tasks,
            limit: 2,
            order: [['title', 'ASC']],
            separate: true,
            as: 'tasks',
            include: [
              {
                association: Task.SubTasks,
                order: [['title', 'DESC']],
                separate: true,
                as: 'subtasks'
              }
            ]
          }],
          order: [
            ['id', 'ASC']
          ]
        });

        expect(users[0].tasks.length).to.equal(2);

        expect(users[0].tasks[0].title).to.equal('a');
        expect(users[0].tasks[0].subtasks.length).to.equal(3);
        expect(users[0].tasks[0].subtasks[0].title).to.equal('c');
        expect(users[0].tasks[0].subtasks[1].title).to.equal('b');
        expect(users[0].tasks[0].subtasks[2].title).to.equal('a');

        expect(users[0].tasks[1].title).to.equal('b');
        expect(users[0].tasks[1].subtasks.length).to.equal(2);
        expect(users[0].tasks[1].subtasks[0].title).to.equal('c');
        expect(users[0].tasks[1].subtasks[1].title).to.equal('a');

        expect(users[1].tasks.length).to.equal(2);
        expect(users[1].tasks[0].title).to.equal('a');
        expect(users[1].tasks[0].subtasks.length).to.equal(3);
        expect(users[1].tasks[0].subtasks[0].title).to.equal('c');
        expect(users[1].tasks[0].subtasks[1].title).to.equal('b');
        expect(users[1].tasks[0].subtasks[2].title).to.equal('a');

        expect(users[1].tasks[1].title).to.equal('b');
        expect(users[1].tasks[1].subtasks.length).to.equal(2);
        expect(users[1].tasks[1].subtasks[0].title).to.equal('b');
        expect(users[1].tasks[1].subtasks[1].title).to.equal('a');
        await this.sequelize.dropSchema('work');
        const schemas = await this.sequelize.showAllSchemas();
        expect(schemas).to.be.empty;
      });
    });
  });

  describe('(1:N)', () => {
    describe('hasAssociation', () => {
      beforeEach(function() {
        this.Article = this.sequelize.define('Article', {
          pk: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
          },
          title: DataTypes.STRING
        });

        this.Label = this.sequelize.define('Label', {
          key: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
          },
          text: DataTypes.STRING
        });

        this.Article.hasMany(this.Label);

        return this.sequelize.sync({ force: true });
      });

      // Reason: CockroachDB guarantees that while a transaction is pending, it is isolated from other concurrent transactions with serializable isolation.
      // https://www.cockroachlabs.com/docs/stable/transactions.html
      it.skip('supports transactions', async function() {
        const sequelize = this.sequelize;
        const Article = sequelize.define('Article', { 'title': DataTypes.STRING });
        const Label = sequelize.define('Label', { 'text': DataTypes.STRING });

        Article.hasMany(Label);

        await sequelize.sync({ force: true });

        const [article, label] = await Promise.all([
          Article.create({ title: 'foo' }),
          Label.create({ text: 'bar' })
        ]);

        const t = await sequelize.transaction();
        await article.setLabels([label], { transaction: t });
        const articles0 = await Article.findAll({ transaction: t });
        const hasLabel0 = await articles0[0].hasLabel(label);
        expect(hasLabel0).to.be.false;
        const articles = await Article.findAll({ transaction: t });
        const hasLabel = await articles[0].hasLabel(label, { transaction: t });
        expect(hasLabel).to.be.true;
        await t.rollback();
      });
    });

    describe('hasAssociations', () => {
      beforeEach(function() {
        this.Article = this.sequelize.define('Article', {
          pk: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
          },
          title: DataTypes.STRING
        });

        this.Label = this.sequelize.define('Label', {
          key: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
          },
          text: DataTypes.STRING
        });

        this.Article.hasMany(this.Label);

        return this.sequelize.sync({ force: true });
      });

      // Reason: CockroachDB guarantees that while a transaction is pending, it is isolated from other concurrent transactions with serializable isolation.
      // https://www.cockroachlabs.com/docs/stable/transactions.html
      it.skip('supports transactions', async function() {
        const sequelize = this.sequelize;
        const Article = sequelize.define('Article', { 'title': DataTypes.STRING });
        const Label = sequelize.define('Label', { 'text': DataTypes.STRING });

        Article.hasMany(Label);

        await sequelize.sync({ force: true });

        const [article, label] = await Promise.all([
          Article.create({ title: 'foo' }),
          Label.create({ text: 'bar' })
        ]);

        const t = await sequelize.transaction();
        await article.setLabels([label], { transaction: t });
        const articles = await Article.findAll({ transaction: t });

        const [hasLabel1, hasLabel2] = await Promise.all([
          articles[0].hasLabels([label]),
          articles[0].hasLabels([label], { transaction: t })
        ]);

        expect(hasLabel1).to.be.false;
        expect(hasLabel2).to.be.true;

        await t.rollback();
      });
    });

    describe('setAssociations', () => {
      // Reason: CockroachDB guarantees that while a transaction is pending, it is isolated from other concurrent transactions with serializable isolation.
      // https://www.cockroachlabs.com/docs/stable/transactions.html
      it.skip('supports transactions', async function() {
        const sequelize = this.sequelize;
        const Article = sequelize.define('Article', { 'title': DataTypes.STRING });
        const Label = sequelize.define('Label', { 'text': DataTypes.STRING });

        Article.hasMany(Label);

        await sequelize.sync({ force: true });

        const [article, label, t] = await Promise.all([
          Article.create({ title: 'foo' }),
          Label.create({ text: 'bar' }),
          sequelize.transaction()
        ]);

        await article.setLabels([label], { transaction: t });
        const labels0 = await Label.findAll({ where: { ArticleId: article.id }, transaction: undefined });
        expect(labels0.length).to.equal(0);

        const labels = await Label.findAll({ where: { ArticleId: article.id }, transaction: t });
        expect(labels.length).to.equal(1);
        await t.rollback();
      });
    });

    describe('addAssociations', () => {
      // Reason: CockroachDB guarantees that while a transaction is pending, it is isolated from other concurrent transactions with serializable isolation.
      // https://www.cockroachlabs.com/docs/stable/transactions.html
      it.skip('supports transactions', async function() {
        const sequelize = this.sequelize;
        const Article = sequelize.define('Article', { 'title': DataTypes.STRING });
        const Label = sequelize.define('Label', { 'text': DataTypes.STRING });
        Article.hasMany(Label);

        await sequelize.sync({ force: true });

        const [article, label] = await Promise.all([
          Article.create({ title: 'foo' }),
          Label.create({ text: 'bar' })
        ]);

        const t = await sequelize.transaction();
        await article.addLabel(label, { transaction: t });
        const labels0 = await Label.findAll({ where: { ArticleId: article.id }, transaction: undefined });
        expect(labels0.length).to.equal(0);

        const labels = await Label.findAll({ where: { ArticleId: article.id }, transaction: t });
        expect(labels.length).to.equal(1);
        await t.rollback();
      });
    });

    describe('createAssociations', () => {
      // Reason: CockroachDB guarantees that while a transaction is pending, it is isolated from other concurrent transactions with serializable isolation.
      // https://www.cockroachlabs.com/docs/stable/transactions.html
      it.skip('supports transactions', async function() {
        const sequelize = (this.sequelize);
        const Article = sequelize.define('Article', { 'title': DataTypes.STRING });
        const Label = sequelize.define('Label', { 'text': DataTypes.STRING });

        Article.hasMany(Label);

        await sequelize.sync({ force: true });
        const article = await Article.create({ title: 'foo' });
        const t = await sequelize.transaction();
        await article.createLabel({ text: 'bar' }, { transaction: t });
        const labels1 = await Label.findAll();
        expect(labels1.length).to.equal(0);
        const labels0 = await Label.findAll({ where: { ArticleId: article.id } });
        expect(labels0.length).to.equal(0);
        const labels = await Label.findAll({ where: { ArticleId: article.id }, transaction: t });
        expect(labels.length).to.equal(1);
        await t.rollback();
      });
    });
  });
});
