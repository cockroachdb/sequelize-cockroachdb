// Copyright 2021 The Cockroach Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
// implied. See the License for the specific language governing
// permissions and limitations under the License.

require('./helper');

const { expect } = require('chai');
const { Sequelize, DataTypes } = require('../source');

describe('QueryInterface', () => {
  beforeEach(function () {
    this.sequelize.options.quoteIdentifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  describe('dropEnum', () => {
    beforeEach(async function () {
      await this.queryInterface.createTable('menus', {
        structuretype: DataTypes.ENUM('menus', 'submenu', 'routine'),
        sequence: DataTypes.INTEGER,
        name: DataTypes.STRING
      });
    });

    it('should be able to drop the specified column', async function () {
      await this.queryInterface.removeColumn('menus', 'structuretype');
      const enumList0 = await this.queryInterface.pgListEnums('menus');

      expect(enumList0).to.have.lengthOf(1);
      expect(enumList0[0])
        .to.have.property('enum_name')
        .and.to.equal('enum_menus_structuretype');
    });

    it('should be able to drop the specified enum after removing the column', async function () {
      await expect(
        this.queryInterface.dropEnum('enum_menus_structuretype')
      ).to.be.eventually.rejectedWith(
        'cannot drop type "enum_menus_structuretype" because other objects ([sequelize_test.public.menus]) still depend on it'
      );

      await this.queryInterface.removeColumn('menus', 'structuretype');

      await this.queryInterface.dropEnum('enum_menus_structuretype');

      const enumList = await this.queryInterface.pgListEnums('menus');

      expect(enumList).to.be.an('array');
      expect(enumList).to.have.lengthOf(0);
    });
  });
});
