'use strict';

require('./helper');

const { expect } = require('chai'),
  { DataTypes } = require('../source'),
  dialect = 'postgres',
  semver = require('semver');

const version_helper = require('../source/version_helper.js')

const crdbVersion = version_helper.GetCockroachDBVersionFromEnvConfig()
const isCRDBVersion21_2Plus =  crdbVersion ? semver.gte(crdbVersion, "21.1.2") : false

// Edited test:
// It is expected to have CRS field in GEOMETRY fields.
// Geometry is only supported in versions 21.2+. We only run this if 
// we're on a version of CockroachDB equal or greater to 21.2.
describe('Model', () => {
  describe('GEOMETRY', () => {
    beforeEach(async function () {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        geometry: DataTypes.GEOMETRY
      });

      await this.User.sync({ force: true });
    });

    (isCRDBVersion21_2Plus ? it : it.skip)('works with aliases fields', async function () {
          const Pub = this.sequelize.define(
          'Pub',
          {
            location: { field: 'coordinates', type: DataTypes.GEOMETRY }
          },
          { timestamps: false }
        ),
        point = { type: 'Point', coordinates: [39.807222, -76.984722] };

      await Pub.sync({ force: true });
      const pub = await Pub.create({ location: point });

      expect(pub).not.to.be.null;
      expect(pub.location).to.be.deep.eql({
        ...point,
        crs: {
          properties: {
            name: 'EPSG:4326'
          },
          type: 'name'
        }
      });
    });

    (isCRDBVersion21_2Plus ? it : it.skip)('should create a geometry object', async function () {
      const User = this.User;
      const point = { type: 'Point', coordinates: [39.807222, -76.984722] };

      const newUser = await User.create({
        username: 'username',
        geometry: point
      });
      expect(newUser).not.to.be.null;
      expect(newUser.geometry).to.be.deep.eql({
        ...point,
        crs: {
          properties: {
            name: 'EPSG:4326'
          },
          type: 'name'
        }
      });
    });

    (isCRDBVersion21_2Plus ? it : it.skip)('should update a geometry object', async function () {
      const User = this.User;
      const point1 = { type: 'Point', coordinates: [39.807222, -76.984722] },
        point2 = { type: 'Point', coordinates: [49.807222, -86.984722] };
      const props = { username: 'username', geometry: point1 };

      await User.create(props);
      await User.update(
        { geometry: point2 },
        { where: { username: props.username } }
      );
      const user = await User.findOne({ where: { username: props.username } });
      expect(user.geometry).to.be.deep.eql({
        ...point2,
        crs: {
          properties: {
            name: 'EPSG:4326'
          },
          type: 'name'
        }
      });
    });

    (isCRDBVersion21_2Plus ? it : it.skip)('works with crs field', async function () {
      const Pub = this.sequelize.define('Pub', {
          location: { field: 'coordinates', type: DataTypes.GEOMETRY }
        }),
        point = {
          type: 'Point',
          coordinates: [39.807222, -76.984722],
          crs: {
            type: 'name',
            properties: {
              name: 'EPSG:4326'
            }
          }
        };

      await Pub.sync({ force: true });
      const pub = await Pub.create({ location: point });
      expect(pub).not.to.be.null;
      expect(pub.location).to.be.deep.eql({
        ...point,
        crs: {
          properties: {
            name: 'EPSG:4326'
          },
          type: 'name'
        }
      });
    });
  });

  describe('GEOMETRY(POINT)', () => {
    beforeEach(async function () {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        geometry: DataTypes.GEOMETRY('POINT')
      });

      await this.User.sync({ force: true });
    });

    (isCRDBVersion21_2Plus ? it : it.skip)('should create a geometry object', async function () {
      const User = this.User;
      const point = { type: 'Point', coordinates: [39.807222, -76.984722] };

      const newUser = await User.create({
        username: 'username',
        geometry: point
      });
      expect(newUser).not.to.be.null;
      expect(newUser.geometry).to.be.deep.eql({
        ...point,
        crs: {
          properties: {
            name: 'EPSG:4326'
          },
          type: 'name'
        }
      });
    });

    (isCRDBVersion21_2Plus ? it : it.skip)('should update a geometry object', async function () {
      const User = this.User;
      const point1 = { type: 'Point', coordinates: [39.807222, -76.984722] },
        point2 = { type: 'Point', coordinates: [49.807222, -86.984722] };
      const props = { username: 'username', geometry: point1 };

      await User.create(props);
      await User.update(
        { geometry: point2 },
        { where: { username: props.username } }
      );
      const user = await User.findOne({ where: { username: props.username } });
      expect(user.geometry).to.be.deep.eql({
        ...point2,
        crs: {
          properties: {
            name: 'EPSG:4326'
          },
          type: 'name'
        }
      });
    });

    (isCRDBVersion21_2Plus ? it : it.skip)('works with crs field', async function () {
      const User = this.User;
      const point = {
        type: 'Point',
        coordinates: [39.807222, -76.984722],
        crs: {
          type: 'name',
          properties: {
            name: 'EPSG:4326'
          }
        }
      };

      const newUser = await User.create({
        username: 'username',
        geometry: point
      });
      expect(newUser).not.to.be.null;
      expect(newUser.geometry).to.be.deep.eql(point);
    });
  });

  describe('GEOMETRY(LINESTRING)', () => {
    beforeEach(async function () {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        geometry: DataTypes.GEOMETRY('LINESTRING')
      });

      await this.User.sync({ force: true });
    });

    (isCRDBVersion21_2Plus ? it : it.skip)('should create a geometry object', async function () {
      const User = this.User;
      const point = {
        type: 'LineString',
        coordinates: [
          [100.0, 0.0],
          [101.0, 1.0]
        ]
      };

      const newUser = await User.create({
        username: 'username',
        geometry: point
      });
      expect(newUser).not.to.be.null;
      expect(newUser.geometry).to.be.deep.eql({
        ...point,
        crs: {
          properties: {
            name: 'EPSG:4326'
          },
          type: 'name'
        }
      });
    });

    (isCRDBVersion21_2Plus ? it : it.skip)('should update a geometry object', async function () {
      const User = this.User;
      const point1 = {
          type: 'LineString',
          coordinates: [
            [100.0, 0.0],
            [101.0, 1.0]
          ]
        },
        point2 = {
          type: 'LineString',
          coordinates: [
            [101.0, 0.0],
            [102.0, 1.0]
          ]
        };
      const props = { username: 'username', geometry: point1 };

      await User.create(props);
      await User.update(
        { geometry: point2 },
        { where: { username: props.username } }
      );
      const user = await User.findOne({ where: { username: props.username } });
      expect(user.geometry).to.be.deep.eql({
        ...point2,
        crs: {
          properties: {
            name: 'EPSG:4326'
          },
          type: 'name'
        }
      });
    });

    (isCRDBVersion21_2Plus ? it : it.skip)('works with crs field', async function () {
      const User = this.User;
      const point = {
        type: 'LineString',
        coordinates: [
          [100.0, 0.0],
          [101.0, 1.0]
        ],
        crs: {
          type: 'name',
          properties: {
            name: 'EPSG:4326'
          }
        }
      };

      const newUser = await User.create({
        username: 'username',
        geometry: point
      });
      expect(newUser).not.to.be.null;
      expect(newUser.geometry).to.be.deep.eql(point);
    });
  });

  describe('GEOMETRY(POLYGON)', () => {
    beforeEach(async function () {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        geometry: DataTypes.GEOMETRY('POLYGON')
      });

      await this.User.sync({ force: true });
    });

    (isCRDBVersion21_2Plus ? it : it.skip)('should create a geometry object', async function () {
      const User = this.User;
      const point = {
        type: 'Polygon',
        coordinates: [
          [
            [100.0, 0.0],
            [101.0, 0.0],
            [101.0, 1.0],
            [100.0, 1.0],
            [100.0, 0.0]
          ]
        ]
      };

      const newUser = await User.create({
        username: 'username',
        geometry: point
      });
      expect(newUser).not.to.be.null;
      expect(newUser.geometry).to.be.deep.eql({
        ...point,
        crs: {
          properties: {
            name: 'EPSG:4326'
          },
          type: 'name'
        }
      });
    });

    (isCRDBVersion21_2Plus ? it : it.skip)('works with crs field', async function () {
      const User = this.User;
      const point = {
        type: 'Polygon',
        coordinates: [
          [
            [100.0, 0.0],
            [101.0, 0.0],
            [101.0, 1.0],
            [100.0, 1.0],
            [100.0, 0.0]
          ]
        ],
        crs: {
          type: 'name',
          properties: {
            name: 'EPSG:4326'
          }
        }
      };

      const newUser = await User.create({
        username: 'username',
        geometry: point
      });
      expect(newUser).not.to.be.null;
      expect(newUser.geometry).to.be.deep.eql({
        ...point,
        crs: {
          properties: {
            name: 'EPSG:4326'
          },
          type: 'name'
        }
      });
    });

    (isCRDBVersion21_2Plus ? it : it.skip)('should update a geometry object', async function () {
      const User = this.User;
      const polygon1 = {
          type: 'Polygon',
          coordinates: [
            [
              [100.0, 0.0],
              [101.0, 0.0],
              [101.0, 1.0],
              [100.0, 1.0],
              [100.0, 0.0]
            ]
          ]
        },
        polygon2 = {
          type: 'Polygon',
          coordinates: [
            [
              [100.0, 0.0],
              [102.0, 0.0],
              [102.0, 1.0],
              [100.0, 1.0],
              [100.0, 0.0]
            ]
          ]
        };
      const props = { username: 'username', geometry: polygon1 };

      await User.create(props);
      await User.update(
        { geometry: polygon2 },
        { where: { username: props.username } }
      );
      const user = await User.findOne({ where: { username: props.username } });
      expect(user.geometry).to.be.deep.eql({
        ...polygon2,
        crs: {
          properties: {
            name: 'EPSG:4326'
          },
          type: 'name'
        }
      });
    });
  });

  describe('sql injection attacks', () => {
    beforeEach(async function () {
      this.Model = this.sequelize.define('Model', {
        location: DataTypes.GEOMETRY
      });
      await this.sequelize.sync({ force: true });
    });

    (isCRDBVersion21_2Plus ? it : it.skip)('should properly escape the single quotes', async function () {
      await this.Model.create({
        location: {
          type: 'Point',
          properties: {
            exploit: "'); DELETE YOLO INJECTIONS; -- "
          },
          coordinates: [39.807222, -76.984722]
        }
      });
    });

    (isCRDBVersion21_2Plus ? it : it.skip)('should properly escape the single quotes in coordinates', async function () {
      expect(
        this.Model.create({
          location: {
            type: 'Point',
            properties: {
              exploit: "'); DELETE YOLO INJECTIONS; -- "
            },
            coordinates: [39.807222, "'); DELETE YOLO INJECTIONS; --"]
          }
        })
      ).to.eventually.throw();
    });
  });
});
