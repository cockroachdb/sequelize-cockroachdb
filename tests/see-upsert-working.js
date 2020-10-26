const { Sequelize, DataTypes } = require('..');
const sequelize = new Sequelize('postgres://root@localhost:26257/sequelize_test');

const log = arg => console.log(JSON.stringify(arg, undefined, 4));

(async () => {
	const User = sequelize.define('user', { name: DataTypes.STRING }, { timestamps: false });
	await sequelize.sync({ force: true });
  const { id } = await User.create({ name: 'Someone' });
  log(await User.findAll());
  log(await User.upsert({ id, name: 'Another Name' }, { returning: true }));
  log(await User.findAll());
	await sequelize.close();
})();
