// Copyright 2017 The Cockroach Authors.
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

var expect = require('chai').expect;
var Sequelize = require('..');

[Sequelize.DataTypes.INTEGER, Sequelize.DataTypes.BIGINT].forEach(function (intType) {
  describe('DataTypes.' + intType.key, function () {
    before(function () {
      this.Foo = this.sequelize.define('foo', {
        i: intType
      });
      return this.Foo.sync({ force: true });
    });

    it('accepts JavaScript integers', function () {
      this.Foo.create({ i: 42 }).then(function (foo) {
        expect(foo.i).to.equal("42");
      });
    });

    it('accepts JavaScript strings that represent 64-bit integers', function () {
      this.Foo.create({ i: "9223372036854775807" }).then(function (foo) {
        expect(foo.i).to.equal("9223372036854775807");
      });
    });

    it('rejects integers that overflow', function () {
      expect(this.Foo.create({ i: "9223372036854775808" }))
        .to.be.rejectedWith('numeric constant out of int64 range');
    });


    it('rejects garbage', function () {
      expect(this.Foo.create({ i: "102.3" }))
        .to.be.rejectedWith('"102.3" is not a valid integer');
    });

    it('rejects dangerous input', function () {
      expect(this.Foo.create({ i: "'" })).to.be.rejectedWith('"\'" is not a valid integer');
    })
  })
});

it('supports int foreign key insertion and update', function () {
  var Post = this.sequelize.define('post', { body: Sequelize.STRING });
  var Comment = this.sequelize.define('comment', { body: Sequelize.STRING });
  Post.hasOne(Comment, { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' });
  return this.sequelize.sync({ force: true }).then(function () {
    return Post.create({
      body: 'Hello, world',
      comment: { body: 'Why, hello!' }
    }, { include: [Comment] });
  }).then(function (post) {
    return post.comment.update({ body: 'Goodbye!' });
  }).then(function () {
    return Post.findAll({ include: [Comment] });
  }).then(function (posts) {
    expect(posts).to.have.lengthOf(1);
    expect(posts[0].body).to.equal('Hello, world');
    expect(posts[0].comment.body).to.equal('Goodbye!');
  });
});
