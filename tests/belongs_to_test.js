require('./helper');

var expect = require('chai').expect;

describe('BelongsTo', () => {
  describe('foreign key', () => {
    // Edit Reason: not a bug, it's how the test is implemented.
    // CRDB does not guarantee gapless sequential ids.
    it('should set foreignKey on foreign table', async function () {
      const Mail = this.sequelize.define('mail', {}, { timestamps: false });
      const Entry = this.sequelize.define('entry', {}, { timestamps: false });
      const User = this.sequelize.define('user', {}, { timestamps: false });

      Entry.belongsTo(User, {
        as: 'owner',
        foreignKey: {
          name: 'ownerId',
          allowNull: false
        }
      });
      Entry.belongsTo(Mail, {
        as: 'mail',
        foreignKey: {
          name: 'mailId',
          allowNull: false
        }
      });
      Mail.belongsToMany(User, {
        as: 'recipients',
        through: 'MailRecipients',
        otherKey: {
          name: 'recipientId',
          allowNull: false
        },
        foreignKey: {
          name: 'mailId',
          allowNull: false
        },
        timestamps: false
      });
      Mail.hasMany(Entry, {
        as: 'entries',
        foreignKey: {
          name: 'mailId',
          allowNull: false
        }
      });
      User.hasMany(Entry, {
        as: 'entries',
        foreignKey: {
          name: 'ownerId',
          allowNull: false
        }
      });

      await this.sequelize.sync({ force: true });
      const user = await User.create({});
      const mail = await Mail.create({});

      await Entry.create({ mailId: mail.id, ownerId: user.id });
      await Entry.create({ mailId: mail.id, ownerId: user.id });
      await mail.setRecipients([user.id]);

      const result = await Entry.findAndCountAll({
        offset: 0,
        limit: 10,
        order: [['id', 'DESC']],
        include: [
          {
            association: Entry.associations.mail,
            include: [
              {
                association: Mail.associations.recipients,
                through: {
                  where: {
                    recipientId: user.id
                  }
                },
                required: true
              }
            ],
            required: true
          }
        ]
      });

      const rowResult = result.rows[0].get({ plain: true });
      const mailResult = rowResult.mail.recipients[0].MailRecipients;

      expect(result.count).to.equal(2);
      expect(rowResult.ownerId).to.equal(user.id);
      expect(rowResult.mailId).to.equal(mail.id);
      expect(mailResult.mailId).to.equal(mail.id);
      expect(mailResult.recipientId).to.equal(user.id);
    });
  });
});
