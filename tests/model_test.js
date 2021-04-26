'use strict';

require('./helper');

const { expect } = require('chai'),
  { Sequelize, DataTypes } = require('../source'),
  sinon = require('sinon'),
  Op = Sequelize.Op;

const Support = {
  dropTestSchemas: async function(sequelize) {
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
  }
}

describe('Model', () => {
  before(function() {
    this.clock = sinon.useFakeTimers();
  });

  after(function() {
    this.clock.restore();
  });

  beforeEach(async function() {
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      secretValue: DataTypes.STRING,
      data: DataTypes.STRING,
      intVal: DataTypes.INTEGER,
      theDate: DataTypes.DATE,
      aBool: DataTypes.BOOLEAN
    });

    await this.User.sync({ force: true });
  });

  describe('constructor', () => {
    // Edit Reason: CRDB creates its primary index named 'primary'. 
    // Ref: https://www.cockroachlabs.com/docs/stable/indexes.html#creation
    // Postgres creates its primary index named something like `${nameOfTheTable}_pkey`.
    // Editing this test to the case.
    it('allows unique on column with field aliases', async function() {
      const User = this.sequelize.define('UserWithUniqueFieldAlias', {
        userName: { type: Sequelize.STRING, unique: 'user_name_unique', field: 'user_name' }
      });

      await User.sync({ force: true });

      const indexes = await this.sequelize.queryInterface.showIndex(User.tableName);
      let idxUnique;

      expect(indexes).to.have.length(2);
      // this expected indexes[1] originally. For CRDB the index we want is at position 0.
      idxUnique = indexes[0];
      expect(idxUnique.primary).to.equal(false);
      expect(idxUnique.unique).to.equal(true);
      expect(idxUnique.fields).to.deep.equal([{
        // it expected order: undefined, changed to order: 'ASC'
        attribute: 'user_name', collate: undefined, order: 'ASC', length: undefined
      }]);
    });

    // Skip reason: Gotta get back to this later. This test breaks because CRDB does not passes Details field
    // at error transmitting. The message seems to be parsed here [1].
    // [1]: https://github.com/sequelize/sequelize/blob/main/lib/dialects/postgres/query.js#L324
    it.skip('allows us to customize the error message for unique constraint', async function() {
      const User = this.sequelize.define('UserWithUniqueUsername', {
        username: { type: Sequelize.STRING, unique: { name: 'user_and_email', msg: 'User and email must be unique' } },
        email: { type: Sequelize.STRING, unique: 'user_and_email' }
      });

      await User.sync({ force: true });

      try {
        await Promise.all([
          User.create({ username: 'tobi', email: 'tobi@tobi.me' }),
          User.create({ username: 'tobi', email: 'tobi@tobi.me' })
        ]);
      } catch (err) {
        if (!(err instanceof Sequelize.UniqueConstraintError)) throw err;
        expect(err.message).to.equal('User and email must be unique');
      }
    });

    // Skipped test Reason: It is not yet supported passing COLLATE with a COLUMN when creating
    // an INDEX there. 
    // Issue: https://github.com/cockroachdb/cockroach/issues/63868
    // A workaround would be: Define the COLUMN with COLLATE; then add INDEX to that COLUMN.

    // If you use migrations to create unique indexes that have explicit names and/or contain fields
    // that have underscore in their name. Then sequelize must use the index name to map the custom message to the error thrown from db.
    it.skip('allows us to map the customized error message with unique constraint name', async function() {
      // Fake migration style index creation with explicit index definition
      let User = this.sequelize.define('UserWithUniqueUsername', {
        user_id: { type: Sequelize.INTEGER },
        email: { type: Sequelize.STRING }
      }, {
        indexes: [
          {
            name: 'user_and_email_index',
            msg: 'User and email must be unique',
            unique: true,
            method: 'BTREE',
            fields: ['user_id', { attribute: 'email', collate: 'en_US', order: 'DESC', length: 5 }]
          }]
      });

      await User.sync({ force: true });

      // Redefine the model to use the index in database and override error message
      User = this.sequelize.define('UserWithUniqueUsername', {
        user_id: { type: Sequelize.INTEGER, unique: { name: 'user_and_email_index', msg: 'User and email must be unique' } },
        email: { type: Sequelize.STRING, unique: 'user_and_email_index' }
      });

      try {
        await Promise.all([
          User.create({ user_id: 1, email: 'tobi@tobi.me' }),
          User.create({ user_id: 1, email: 'tobi@tobi.me' })
        ]);
      } catch (err) {
        if (!(err instanceof Sequelize.UniqueConstraintError)) throw err;
        expect(err.message).to.equal('User and email must be unique');
      }
    });

    // Skipped test Reason: It is not yet supported passing COLLATE with a COLUMN when creating
    // an INDEX there. 
    // Issue: https://github.com/cockroachdb/cockroach/issues/63868
    // A workaround would be: Define the COLUMN with COLLATE; then add INDEX to that COLUMN.
    it.skip('should allow the user to specify indexes in options', async function() {
      const indices = [{
        name: 'a_b_uniq',
        unique: true,
        method: 'BTREE',
        fields: [
          'fieldB',
          {
            attribute: 'fieldA',
            collate: 'en_US',
            order: 'DESC',
            length: 5
          }
        ]
      }];

      indices.push({
        type: 'FULLTEXT',
        fields: ['fieldC'],
        concurrently: true
      });

      indices.push({
        type: 'FULLTEXT',
        fields: ['fieldD']
      });

      const Model = this.sequelize.define('model', {
        fieldA: Sequelize.STRING,
        fieldB: Sequelize.INTEGER,
        fieldC: Sequelize.STRING,
        fieldD: Sequelize.STRING
      }, {
        indexes: indices,
        engine: 'MyISAM'
      });

      await this.sequelize.sync();
      await this.sequelize.sync(); // The second call should not try to create the indices again
      const args = await this.sequelize.queryInterface.showIndex(Model.tableName);
      let primary, idx1, idx2, idx3;

      // Postgres returns indexes in alphabetical order
      primary = args[2];
      idx1 = args[0];
      idx2 = args[1];
      idx3 = args[2];

      expect(idx1.fields).to.deep.equal([
        { attribute: 'fieldB', length: undefined, order: undefined, collate: undefined },
        { attribute: 'fieldA', length: undefined, order: 'DESC', collate: 'en_US' }
      ]);

      expect(idx2.fields).to.deep.equal([
        { attribute: 'fieldC', length: undefined, order: undefined, collate: undefined }
      ]);

      expect(idx3.fields).to.deep.equal([
        { attribute: 'fieldD', length: undefined, order: undefined, collate: undefined }
      ]);
      expect(idx1.name).to.equal('a_b_uniq');
      expect(idx1.unique).to.be.ok;
    });
  });

  // Edit Reason: 
  // All tests in this 'destroy' section were edited to fit CRDB application.
  // In general, these tests expects id => pk = 1, CRDB does not generate human readable ids by default.
  // Rewrote them to force ids to be incremental and human readable. 
  describe('destroy', () => {
    it('does not set deletedAt for previously destroyed instances if paranoid is true', async function() {
      const User = this.sequelize.define('UserCol', {
        secretValue: Sequelize.STRING,
        username: Sequelize.STRING
      }, { paranoid: true });

      await User.sync({ force: true });
      await User.bulkCreate([
        // Added gapless incremental ids
        { id: 1, username: 'Toni', secretValue: '42' },
        { id: 2, username: 'Tobi', secretValue: '42' },
        { id: 3, username: 'Max', secretValue: '42' }
      ]);

      const user = await User.findByPk(1);
      await user.destroy();
      await user.reload({ paranoid: false });
      const deletedAt = user.deletedAt;
      await User.destroy({ where: { secretValue: '42' } });
      await user.reload({ paranoid: false });

      expect(user.deletedAt).to.eql(deletedAt);
    });

    describe("can't find records marked as deleted with paranoid being true", () => {
      it('with the DAOFactory', async function() {
        const User = this.sequelize.define('UserCol', {
          username: Sequelize.STRING
        }, { paranoid: true });

        await User.sync({ force: true });
        await User.bulkCreate([
          // Added gapless incremental ids
          { id: 1, username: 'Toni' },
          { id: 2, username: 'Tobi' },
          { id: 3, username: 'Max' }
        ]);
        const user = await User.findByPk(1);
        await user.destroy();
        expect(await User.findByPk(1)).to.be.null;
        expect(await User.count()).to.equal(2);
        expect(await User.findAll()).to.have.length(2);
      });
    });

    describe('can find paranoid records if paranoid is marked as false in query', () => {
      it('with the DAOFactory', async function() {
        const User = this.sequelize.define('UserCol', {
          username: Sequelize.STRING
        }, { paranoid: true });

        await User.sync({ force: true });
        await User.bulkCreate([
          // Added gapless incremental ids
          { id: 1, username: 'Toni' },
          { id: 2, username: 'Tobi' },
          { id: 3, username: 'Max' }
        ]);
        const user = await User.findByPk(1);
        await user.destroy();
        expect(await User.findOne({ where: 1, paranoid: false })).to.exist;
        expect(await User.findByPk(1)).to.be.null;
        expect(await User.count()).to.equal(2);
        expect(await User.count({ paranoid: false })).to.equal(3);
      });
    });

    it('should include deleted associated records if include has paranoid marked as false', async function() {
      const User = this.sequelize.define('User', {
        username: Sequelize.STRING
      }, { paranoid: true });
      const Pet = this.sequelize.define('Pet', {
        name: Sequelize.STRING,
        UserId: Sequelize.INTEGER
      }, { paranoid: true });

      User.hasMany(Pet);
      Pet.belongsTo(User);

      await User.sync({ force: true });
      await Pet.sync({ force: true });

      const userId = (await User.create({ username: 'Joe' })).id;
      await Pet.bulkCreate([
        // Added gapless incremental ids
        { id: 1, name: 'Fido', UserId: userId },
        { id: 2, name: 'Fifi', UserId: userId }
      ]);
      const pet = await Pet.findByPk(1);
      await pet.destroy();
      const user = await User.findOne({
        where: { id: userId },
        include: Pet
      });
      const userWithDeletedPets = await User.findOne({
        where: { id: userId },
        include: { model: Pet, paranoid: false }
      });
      expect(user).to.exist;
      expect(user.Pets).to.have.length(1);
      expect(userWithDeletedPets).to.exist;
      expect(userWithDeletedPets.Pets).to.have.length(2);
    });
  });

  describe('schematic support', () => {
    beforeEach(async function() {
      this.UserPublic = this.sequelize.define('UserPublic', {
        age: Sequelize.INTEGER
      });

      this.UserSpecial = this.sequelize.define('UserSpecial', {
        age: Sequelize.INTEGER
      });

      await Support.dropTestSchemas(this.sequelize);
      await this.sequelize.createSchema('schema_test');
      await this.sequelize.createSchema('special');
      this.UserSpecialSync = await this.UserSpecial.schema('special').sync({ force: true });
    });

    afterEach(async function() {
      try {
        await this.sequelize.dropSchema('schema_test');
      } finally {
        await this.sequelize.dropSchema('special');
        await this.sequelize.dropSchema('prefix');
      }
    });

    // Edited test reason: Postgres expected length is 2, being ['schema_test', 'special']
    // CRDB schemas are: ['crdb_internal', 'schema_test', 'special']
    it('should be able to list schemas', async function() {
      const schemas = await this.sequelize.showAllSchemas();
      expect(schemas).to.be.instanceof(Array);
      // originally it expected .to.have.length(expectedLength[dialect]); and being dialect postgres, length = 2.
      expect(schemas).to.deep.equal(['crdb_internal', 'schema_test', 'special'])
    });

    // Skipped test: CRDB does not work with sequences. 
    // PG responds: nextval('special."Publics_id_seq"'::regclass)
    // CRDB responds: unique_rowid()
    it.skip('should describeTable using the default schema settings', async function() {
      const UserPublic = this.sequelize.define('Public', {
        username: Sequelize.STRING
      });

      let test = 0;

      await UserPublic.sync({ force: true });
      await UserPublic.schema('special').sync({ force: true });

      let table = await this.sequelize.queryInterface.describeTable('Publics');

      console.log('table1', table.id);
      test++;
      expect(table.id.defaultValue).to.not.contain('special');

      table = await this.sequelize.queryInterface.describeTable('Publics', { schema: 'special' });

      console.log('table2', table.id);
      test++;
      expect(table.id.defaultValue).to.contain('special');

      expect(test).to.equal(2);
    });
  });

  describe('paranoid is true and where is an array', () => {
    beforeEach(async function() {
      this.User = this.sequelize.define('User', { username: DataTypes.STRING }, { paranoid: true });
      this.Project = this.sequelize.define('Project', { title: DataTypes.STRING }, { paranoid: true });

      this.Project.belongsToMany(this.User, { through: 'project_user' });
      this.User.belongsToMany(this.Project, { through: 'project_user' });

      await this.sequelize.sync({ force: true });

      // Added ids to this bulkCreate because 
      // CRDB does not give low incremental ids.
      await this.User.bulkCreate([{
        id: 1,
        username: 'leia'
      }, {
        id: 2,
        username: 'luke'
      }, {
        id: 3,
        username: 'vader'
      }]);

      await this.Project.bulkCreate([{
        title: 'republic'
      }, {
        title: 'empire'
      }]);

      const users = await this.User.findAll();
      const projects = await this.Project.findAll();
      const leia = users[0],
        luke = users[1],
        vader = users[2],
        republic = projects[0],
        empire = projects[1];
      await leia.setProjects([republic]);
      await luke.setProjects([republic]);
      await vader.setProjects([empire]);
      
      // Mark leia as destroyed at Date(0) + 100 so test can look for entries greater than Date(0)
      this.clock.tick(100);
      await leia.destroy();
    });

    // Reason: It fails because ids originally are not 1, 2, 3.
    // Edited beforeEach to match the expectation.
    // Skipped this test on CI.
    it('should not fail when array contains Sequelize.or / and', async function() {
      const res = await this.User.findAll({
        where: [
          this.sequelize.or({ username: 'vader' }, { username: 'luke' }),
          this.sequelize.and({ id: [1, 2, 3] })
        ]
      });

      expect(res).to.have.length(2);
    });

    // This test depends on this.clock.this(100) and sequential ids on beforeEach.
    it('should not overwrite a specified deletedAt (complex query) by setting paranoid: false', async function() {
      const res = await this.User.findAll({
        paranoid: false,
        where: [
          this.sequelize.or({ username: 'leia' }, { username: 'luke' }),
          this.sequelize.and(
            { id: [1, 2, 3] },
            this.sequelize.or({ deletedAt: null }, { deletedAt: { [Op.gt]: new Date(0) } })
          )
        ]
      });

      expect(res).to.have.length(2);
    });
  });

  // Reason: Transactions are isolated per node in CRDB.
  it.skip('supports multiple async transactions', async function() {
    this.timeout(90000);
    const sequelize = await Support.prepareTransactionTest(this.sequelize);
    const User = sequelize.define('User', { username: Sequelize.STRING });
    const testAsync = async function() {
      const t0 = await sequelize.transaction();

      await User.create({
        username: 'foo'
      }, {
        transaction: t0
      });

      const users0 = await User.findAll({
        where: {
          username: 'foo'
        }
      });

      expect(users0).to.have.length(0);

      const users = await User.findAll({
        where: {
          username: 'foo'
        },
        transaction: t0
      });

      expect(users).to.have.length(1);
      const t = t0;
      return t.rollback();
    };
    await User.sync({ force: true });
    const tasks = [];
    for (let i = 0; i < 1000; i++) {
      tasks.push(testAsync);
    }

    await pMap(tasks, entry => {
      return entry();
    }, {
      // Needs to be one less than ??? else the non transaction query won't ever get a connection
      concurrency: (sequelize.config.pool && sequelize.config.pool.max || 5) - 1
    });
  });
});