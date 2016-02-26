let rethinkdbdash = require('rethinkdbdash')
import {utils} from 'js-data'
const {
  addHiddenPropsToTarget,
  fillIn,
  forEachRelation,
  forOwn,
  get,
  isArray,
  isObject,
  isString,
  isUndefined,
  resolve
} = utils

const underscore = require('mout/string/underscore')

const reserved = [
  'orderBy',
  'sort',
  'limit',
  'offset',
  'skip',
  'where'
]

const unique = function (array) {
  const seen = {}
  const final = []
  array.forEach(function (item) {
    if (item in seen) {
      return
    }
    final.push(item)
    seen[item] = 0
  })
  return final
}

const noop = function (...args) {
  const self = this
  const opts = args[args.length - 1]
  self.dbg(opts.op, ...args)
  return resolve()
}

const noop2 = function (...args) {
  const self = this
  const opts = args[args.length - 2]
  self.dbg(opts.op, ...args)
  return resolve()
}

const DEFAULTS = {
  /**
   * TODO
   *
   * @name RethinkDBAdapter#authKey
   * @type {string}
   */
  authKey: '',

  /**
   * TODO
   *
   * @name RethinkDBAdapter#bufferSize
   * @type {number}
   * @default 10
   */
  bufferSize: 10,

  /**
   * TODO
   *
   * @name RethinkDBAdapter#db
   * @type {string}
   * @default "test"
   */
  db: 'test',

  /**
   * TODO
   *
   * @name RethinkDBAdapter#debug
   * @type {boolean}
   * @default false
   */
  debug: false,

  /**
   * TODO
   *
   * @name RethinkDBAdapter#host
   * @type {string}
   * @default "localhost"
   */
  host: 'localhost',

  /**
   * TODO
   *
   * @name RethinkDBAdapter#min
   * @type {number}
   * @default 10
   */
  min: 10,

  /**
   * TODO
   *
   * @name RethinkDBAdapter#max
   * @type {number}
   * @default 50
   */
  max: 50,

  /**
   * TODO
   *
   * @name RethinkDBAdapter#port
   * @type {number}
   * @default 10
   */
  port: 28015,

  /**
   * TODO
   *
   * @name RethinkDBAdapter#raw
   * @type {boolean}
   * @default false
   */
  raw: false,

  /**
   * TODO
   *
   * @name RethinkDBAdapter#returnDeletedIds
   * @type {boolean}
   * @default false
   */
  returnDeletedIds: false
}

/**
 * RethinkDBAdapter class.
 *
 * @example
 * import {DS} from 'js-data'
 * import RethinkDBAdapter from 'js-data-rethinkdb'
 * const store = new DS()
 * const adapter = new RethinkDBAdapter()
 * store.registerAdapter('rethinkdb', adapter, { 'default': true })
 *
 * @class RethinkDBAdapter
 * @param {Object} [opts] Configuration opts.
 * @param {string} [opts.host='localhost'] TODO
 * @param {number} [opts.port=28015] TODO
 * @param {string} [opts.authKey=''] TODO
 * @param {string} [opts.db='test'] TODO
 * @param {number} [opts.min=10] TODO
 * @param {number} [opts.max=50] TODO
 * @param {number} [opts.bufferSize=10] TODO
 */
export default function RethinkDBAdapter (opts) {
  const self = this
  opts || (opts = {})
  fillIn(opts, DEFAULTS)
  fillIn(self, opts)
  self.r = rethinkdbdash(opts)
  self.databases = {}
  self.tables = {}
  self.indices = {}
}

addHiddenPropsToTarget(RethinkDBAdapter.prototype, {
  _handleErrors (cursor) {
    if (cursor && cursor.errors > 0) {
      if (cursor.first_error) {
        throw new Error(cursor.first_error)
      }
      throw new Error('Unknown RethinkDB Error')
    }
  },
  /**
   * @name RethinkDBAdapter#afterCreate
   * @method
   */
  afterCreate: noop2,

  /**
   * @name RethinkDBAdapter#afterCreateMany
   * @method
   */
  afterCreateMany: noop2,

  /**
   * @name RethinkDBAdapter#afterDestroy
   * @method
   */
  afterDestroy: noop2,

  /**
   * @name RethinkDBAdapter#afterDestroyAll
   * @method
   */
  afterDestroyAll: noop2,

  /**
   * @name RethinkDBAdapter#afterFind
   * @method
   */
  afterFind: noop2,

  /**
   * @name RethinkDBAdapter#afterFindAll
   * @method
   */
  afterFindAll: noop2,

  /**
   * @name RethinkDBAdapter#afterUpdate
   * @method
   */
  afterUpdate: noop2,

  /**
   * @name RethinkDBAdapter#afterUpdateAll
   * @method
   */
  afterUpdateAll: noop2,

  /**
   * @name RethinkDBAdapter#afterUpdateMany
   * @method
   */
  afterUpdateMany: noop2,

  /**
   * @name RethinkDBAdapter#beforeCreate
   * @method
   */
  beforeCreate: noop,

  /**
   * @name RethinkDBAdapter#beforeCreateMany
   * @method
   */
  beforeCreateMany: noop,

  /**
   * @name RethinkDBAdapter#beforeDestroy
   * @method
   */
  beforeDestroy: noop,

  /**
   * @name RethinkDBAdapter#beforeDestroyAll
   * @method
   */
  beforeDestroyAll: noop,

  /**
   * @name RethinkDBAdapter#beforeFind
   * @method
   */
  beforeFind: noop,

  /**
   * @name RethinkDBAdapter#beforeFindAll
   * @method
   */
  beforeFindAll: noop,

  /**
   * @name RethinkDBAdapter#beforeUpdate
   * @method
   */
  beforeUpdate: noop,

  /**
   * @name RethinkDBAdapter#beforeUpdateAll
   * @method
   */
  beforeUpdateAll: noop,

  /**
   * @name RethinkDBAdapter#beforeUpdateMany
   * @method
   */
  beforeUpdateMany: noop,

  /**
   * @name RethinkDBAdapter#dbg
   * @method
   */
  dbg (...args) {
    this.log('debug', ...args)
  },

  selectDb (opts) {
    return this.r.db(isUndefined(opts.db) ? this.db : opts.db)
  },

  selectTable (Resource, opts) {
    return this.selectDb(opts).table(Resource.table || underscore(Resource.name))
  },

  filterSequence (sequence, params) {
    let r = this.r
    params = params || {}
    params.where = params.where || {}
    params.orderBy = params.orderBy || params.sort
    params.skip = params.skip || params.offset

    Object.keys(params).forEach(function (k) {
      let v = params[k]
      if (reserved.indexOf(k) === -1) {
        if (isObject(v)) {
          params.where[k] = v
        } else {
          params.where[k] = {
            '==': v
          }
        }
        delete params[k]
      }
    })

    let query = sequence

    if (Object.keys(params.where).length !== 0) {
      query = query.filter(function (row) {
        let subQuery
        forOwn(params.where, function (criteria, field) {
          if (!isObject(criteria)) {
            criteria = { '==': criteria }
          }
          forOwn(criteria, function (v, op) {
            if (op === '==' || op === '===') {
              subQuery = subQuery ? subQuery.and(row(field).default(null).eq(v)) : row(field).default(null).eq(v)
            } else if (op === '!=' || op === '!==') {
              subQuery = subQuery ? subQuery.and(row(field).default(null).ne(v)) : row(field).default(null).ne(v)
            } else if (op === '>') {
              subQuery = subQuery ? subQuery.and(row(field).default(null).gt(v)) : row(field).default(null).gt(v)
            } else if (op === '>=') {
              subQuery = subQuery ? subQuery.and(row(field).default(null).ge(v)) : row(field).default(null).ge(v)
            } else if (op === '<') {
              subQuery = subQuery ? subQuery.and(row(field).default(null).lt(v)) : row(field).default(null).lt(v)
            } else if (op === '<=') {
              subQuery = subQuery ? subQuery.and(row(field).default(null).le(v)) : row(field).default(null).le(v)
            } else if (op === 'isectEmpty') {
              subQuery = subQuery ? subQuery.and(row(field).default([]).setIntersection(r.expr(v).default([])).count().eq(0)) : row(field).default([]).setIntersection(r.expr(v).default([])).count().eq(0)
            } else if (op === 'isectNotEmpty') {
              subQuery = subQuery ? subQuery.and(row(field).default([]).setIntersection(r.expr(v).default([])).count().ne(0)) : row(field).default([]).setIntersection(r.expr(v).default([])).count().ne(0)
            } else if (op === 'in') {
              subQuery = subQuery ? subQuery.and(r.expr(v).default(r.expr([])).contains(row(field).default(null))) : r.expr(v).default(r.expr([])).contains(row(field).default(null))
            } else if (op === 'notIn') {
              subQuery = subQuery ? subQuery.and(r.expr(v).default(r.expr([])).contains(row(field).default(null)).not()) : r.expr(v).default(r.expr([])).contains(row(field).default(null)).not()
            } else if (op === 'contains') {
              subQuery = subQuery ? subQuery.and(row(field).default([]).contains(v)) : row(field).default([]).contains(v)
            } else if (op === 'notContains') {
              subQuery = subQuery ? subQuery.and(row(field).default([]).contains(v).not()) : row(field).default([]).contains(v).not()
            } else if (op === '|==' || op === '|===') {
              subQuery = subQuery ? subQuery.or(row(field).default(null).eq(v)) : row(field).default(null).eq(v)
            } else if (op === '|!=' || op === '|!==') {
              subQuery = subQuery ? subQuery.or(row(field).default(null).ne(v)) : row(field).default(null).ne(v)
            } else if (op === '|>') {
              subQuery = subQuery ? subQuery.or(row(field).default(null).gt(v)) : row(field).default(null).gt(v)
            } else if (op === '|>=') {
              subQuery = subQuery ? subQuery.or(row(field).default(null).ge(v)) : row(field).default(null).ge(v)
            } else if (op === '|<') {
              subQuery = subQuery ? subQuery.or(row(field).default(null).lt(v)) : row(field).default(null).lt(v)
            } else if (op === '|<=') {
              subQuery = subQuery ? subQuery.or(row(field).default(null).le(v)) : row(field).default(null).le(v)
            } else if (op === '|isectEmpty') {
              subQuery = subQuery ? subQuery.or(row(field).default([]).setIntersection(r.expr(v).default([])).count().eq(0)) : row(field).default([]).setIntersection(r.expr(v).default([])).count().eq(0)
            } else if (op === '|isectNotEmpty') {
              subQuery = subQuery ? subQuery.or(row(field).default([]).setIntersection(r.expr(v).default([])).count().ne(0)) : row(field).default([]).setIntersection(r.expr(v).default([])).count().ne(0)
            } else if (op === '|in') {
              subQuery = subQuery ? subQuery.or(r.expr(v).default(r.expr([])).contains(row(field).default(null))) : r.expr(v).default(r.expr([])).contains(row(field).default(null))
            } else if (op === '|notIn') {
              subQuery = subQuery ? subQuery.or(r.expr(v).default(r.expr([])).contains(row(field).default(null)).not()) : r.expr(v).default(r.expr([])).contains(row(field).default(null)).not()
            } else if (op === '|contains') {
              subQuery = subQuery ? subQuery.or(row(field).default([]).contains(v)) : row(field).default([]).contains(v)
            } else if (op === '|notContains') {
              subQuery = subQuery ? subQuery.or(row(field).default([]).contains(v).not()) : row(field).default([]).contains(v).not()
            }
          })
        })
        return subQuery || true
      })
    }

    if (params.orderBy) {
      if (isString(params.orderBy)) {
        params.orderBy = [
          [params.orderBy, 'asc']
        ]
      }
      for (var i = 0; i < params.orderBy.length; i++) {
        if (isString(params.orderBy[i])) {
          params.orderBy[i] = [params.orderBy[i], 'asc']
        }
        query = (params.orderBy[i][1] || '').toUpperCase() === 'DESC' ? query.orderBy(r.desc(params.orderBy[i][0])) : query.orderBy(params.orderBy[i][0])
      }
    }

    if (params.skip) {
      query = query.skip(+params.skip)
    }

    if (params.limit) {
      query = query.limit(+params.limit)
    }

    return query
  },

  waitForDb (opts) {
    const self = this
    opts || (opts = {})
    const db = isUndefined(opts.db) ? self.db : opts.db
    if (!self.databases[db]) {
      self.databases[db] = self.r.branch(
        self.r.dbList().contains(db),
        true,
        self.r.dbCreate(db)
      ).run()
    }
    return self.databases[db]
  },

  /**
   * Create a new record.
   *
   * @name RethinkDBAdapter#create
   * @method
   * @param {Object} mapper The mapper.
   * @param {Object} props The record to be created.
   * @param {Object} [opts] Configuration options.
   * @param {boolean} [opts.raw=false] TODO
   * @return {Promise}
   */
  create (mapper, props, opts) {
    const self = this
    let op
    props || (props = {})
    opts || (opts = {})

    return self.waitForTable(mapper.table || underscore(mapper.name), opts).then(function () {
      // beforeCreate lifecycle hook
      op = opts.op = 'beforeCreate'
      return resolve(self[op](mapper, props, opts))
    }).then(function (_props) {
      // Allow for re-assignment from lifecycle hook
      _props = isUndefined(_props) ? props : _props
      return self.selectTable(mapper, opts).insert(_props, { returnChanges: true }).run()
    }).then(function (cursor) {
      self._handleErrors(cursor)
      let record
      if (cursor && cursor.changes && cursor.changes.length && cursor.changes[0].new_val) {
        record = cursor.changes[0].new_val
      }
      // afterCreate lifecycle hook
      op = opts.op = 'afterCreate'
      return self[op](mapper, props, opts, record).then(function (_record) {
        // Allow for re-assignment from lifecycle hook
        record = isUndefined(_record) ? record : _record
        const result = {}
        fillIn(result, cursor)
        result.data = record
        result.created = record ? 1 : 0
        return self.getRaw(opts) ? result : result.data
      })
    })
  },

  /**
   * Create multiple records in a single batch.
   *
   * @name RethinkDBAdapter#createMany
   * @method
   * @param {Object} mapper The mapper.
   * @param {Object} props The records to be created.
   * @param {Object} [opts] Configuration options.
   * @param {boolean} [opts.raw=false] TODO
   * @return {Promise}
   */
  createMany (mapper, props, opts) {
    const self = this
    let op
    props || (props = {})
    opts || (opts = {})

    return self.waitForTable(mapper.table || underscore(mapper.name), opts).then(function () {
      // beforeCreateMany lifecycle hook
      op = opts.op = 'beforeCreateMany'
      return resolve(self[op](mapper, props, opts))
    }).then(function (_props) {
      // Allow for re-assignment from lifecycle hook
      _props = isUndefined(_props) ? props : _props
      return self.selectTable(mapper, opts).insert(_props, { returnChanges: true }).run()
    }).then(function (cursor) {
      self._handleErrors(cursor)
      let records = []
      if (cursor && cursor.changes && cursor.changes.length && cursor.changes) {
        records = cursor.changes.map(function (change) {
          return change.new_val
        })
      }
      // afterCreateMany lifecycle hook
      op = opts.op = 'afterCreateMany'
      return self[op](mapper, props, opts, records).then(function (_records) {
        // Allow for re-assignment from lifecycle hook
        records = isUndefined(_records) ? records : _records
        const result = {}
        fillIn(result, cursor)
        result.data = records
        result.created = records.length
        return self.getRaw(opts) ? result : result.data
      })
    })
  },

  /**
   * Destroy the record with the given primary key.
   *
   * @name RethinkDBAdapter#destroy
   * @method
   * @param {Object} mapper The mapper.
   * @param {(string|number)} id Primary key of the record to destroy.
   * @param {Object} [opts] Configuration options.
   * @param {boolean} [opts.raw=false] TODO
   * @param {boolean} [opts.returnDeletedIds=false] Whether to return the
   * primary keys of any deleted records.
   * @return {Promise}
   */
  destroy (mapper, id, opts) {
    const self = this
    let op
    opts || (opts = {})
    const returnDeletedIds = isUndefined(opts.returnDeletedIds) ? self.returnDeletedIds : !!opts.returnDeletedIds

    return self.waitForTable(mapper.table || underscore(mapper.name), opts).then(function () {
      // beforeDestroy lifecycle hook
      op = opts.op = 'beforeDestroy'
      return resolve(self[op](mapper, id, opts))
    }).then(function () {
      op = opts.op = 'destroy'
      self.dbg(op, id, opts)
      return self.selectTable(mapper, opts).get(id).delete().run()
    }).then(function (cursor) {
      let deleted = 0
      if (cursor && cursor.deleted) {
        deleted = cursor.deleted
      }
      // afterDestroy lifecycle hook
      op = opts.op = 'afterDestroy'
      return resolve(self[op](mapper, id, opts, deleted ? id : undefined)).then(function (_id) {
        // Allow for re-assignment from lifecycle hook
        id = isUndefined(_id) && returnDeletedIds ? id : _id
        const result = {}
        fillIn(result, cursor)
        result.data = deleted ? id : undefined
        return self.getRaw(opts) ? result : result.data
      })
    })
  },

  /**
   * Destroy the records that match the selection query.
   *
   * @name RethinkDBAdapter#destroyAll
   * @method
   * @param {Object} mapper the mapper.
   * @param {Object} [query] Selection query.
   * @param {Object} [opts] Configuration options.
   * @param {boolean} [opts.raw=false] TODO
   * @param {boolean} [opts.returnDeletedIds=false] Whether to return the
   * primary keys of any deleted records.
   * @return {Promise}
   */
  destroyAll (mapper, query, opts) {
    const self = this
    const idAttribute = mapper.idAttribute
    let op
    query || (query = {})
    opts || (opts = {})
    const returnDeletedIds = isUndefined(opts.returnDeletedIds) ? self.returnDeletedIds : !!opts.returnDeletedIds

    return self.waitForTable(mapper.table || underscore(mapper.name), opts).then(function () {
      // beforeDestroyAll lifecycle hook
      op = opts.op = 'beforeDestroyAll'
      return resolve(self[op](mapper, query, opts))
    }).then(function () {
      op = opts.op = 'destroyAll'
      self.dbg(op, query, opts)
      return self
        .filterSequence(self.selectTable(mapper, opts), query)
        .delete({ returnChanges: returnDeletedIds })
        .merge(function (cursor) {
          return {
            changes: cursor('changes').default([]).map(function (record) {
              return record('old_val').default({})(idAttribute).default({})
            }).filter(function (id) {
              return id
            })
          }
        })
        .run()
    }).then(function (cursor) {
      let deletedIds
      if (cursor && cursor.changes && returnDeletedIds) {
        deletedIds = cursor.changes
        delete cursor.changes
      }
      // afterDestroyAll lifecycle hook
      op = opts.op = 'afterDestroyAll'
      return resolve(self[op](mapper, query, opts, deletedIds)).then(function (_deletedIds) {
        // Allow for re-assignment from lifecycle hook
        deletedIds = isUndefined(_deletedIds) ? deletedIds : _deletedIds
        const result = {}
        fillIn(result, cursor)
        result.data = deletedIds
        return self.getRaw(opts) ? result : result.data
      })
    })
  },

  /**
   * TODO
   *
   * There may be reasons why you may want to override this method, like when
   * the id of the parent doesn't exactly match up to the key on the child.
   *
   * @name RethinkDBAdapter#makeHasManyForeignKey
   * @method
   * @return {*}
   */
  makeHasManyForeignKey (Resource, def, record) {
    return def.getForeignKey(record)
  },

  /**
   * TODO
   *
   * @name RethinkDBAdapter#loadHasMany
   * @method
   * @return {Promise}
   */
  loadHasMany (Resource, def, records, __opts) {
    const self = this
    let singular = false

    if (isObject(records) && !isArray(records)) {
      singular = true
      records = [records]
    }
    const IDs = records.map(function (record) {
      return self.makeHasManyForeignKey(Resource, def, record)
    })
    const query = {}
    const criteria = query[def.foreignKey] = {}
    if (singular) {
      // more efficient query when we only have one record
      criteria['=='] = IDs[0]
    } else {
      criteria['in'] = IDs.filter(function (id) {
        return id
      })
    }
    return self.findAll(def.getRelation(), query, __opts).then(function (relatedItems) {
      records.forEach(function (record) {
        let attached = []
        // avoid unneccesary iteration when we only have one record
        if (singular) {
          attached = relatedItems
        } else {
          relatedItems.forEach(function (relatedItem) {
            if (get(relatedItem, def.foreignKey) === record[Resource.idAttribute]) {
              attached.push(relatedItem)
            }
          })
        }
        def.setLocalField(record, attached)
      })
    })
  },

  /**
   * TODO
   *
   * @name RethinkDBAdapter#loadHasOne
   * @method
   * @return {Promise}
   */
  loadHasOne (Resource, def, records, __opts) {
    if (isObject(records) && !isArray(records)) {
      records = [records]
    }
    return this.loadHasMany(Resource, def, records, __opts).then(function () {
      records.forEach(function (record) {
        const relatedData = def.getLocalField(record)
        if (isArray(relatedData) && relatedData.length) {
          def.setLocalField(record, relatedData[0])
        }
      })
    })
  },

  /**
   * TODO
   *
   * @name RethinkDBAdapter#makeBelongsToForeignKey
   * @method
   * @return {*}
   */
  makeBelongsToForeignKey (Resource, def, record) {
    return def.getForeignKey(record)
  },

  /**
   * TODO
   *
   * @name RethinkDBAdapter#loadBelongsTo
   * @method
   * @return {Promise}
   */
  loadBelongsTo (mapper, def, records, __opts) {
    const self = this
    const relationDef = def.getRelation()

    if (isObject(records) && !isArray(records)) {
      const record = records
      return self.find(relationDef, self.makeBelongsToForeignKey(mapper, def, record), __opts).then(function (relatedItem) {
        def.setLocalField(record, relatedItem)
      })
    } else {
      const keys = records.map(function (record) {
        return self.makeBelongsToForeignKey(mapper, def, record)
      }).filter(function (key) {
        return key
      })
      return self.findAll(relationDef, {
        where: {
          [relationDef.idAttribute]: {
            'in': keys
          }
        }
      }, __opts).then(function (relatedItems) {
        records.forEach(function (record) {
          relatedItems.forEach(function (relatedItem) {
            if (relatedItem[relationDef.idAttribute] === record[def.foreignKey]) {
              def.setLocalField(record, relatedItem)
            }
          })
        })
      })
    }
  },

  /**
   * Retrieve the record with the given primary key.
   *
   * @name RethinkDBAdapter#find
   * @method
   * @param {Object} mapper The mapper.
   * @param {(string|number)} id Primary key of the record to retrieve.
   * @param {Object} [opts] Configuration options.
   * @param {boolean} [opts.raw=false] TODO
   * @param {string[]} [opts.with=[]] TODO
   * @return {Promise}
   */
  find (mapper, id, opts) {
    const self = this
    let record, op
    opts || (opts = {})
    opts.with || (opts.with = [])

    const table = mapper.table || underscore(mapper.name)
    const relationList = mapper.relationList || []
    let tasks = [self.waitForTable(table, opts)]

    relationList.forEach(function (def) {
      const relationName = def.relation
      const relationDef = def.getRelation()
      if (!opts.with || opts.with.indexOf(relationName) === -1) {
        return
      }
      if (def.foreignKey && def.type !== 'belongsTo') {
        if (def.type === 'belongsTo') {
          tasks.push(self.waitForIndex(mapper.table || underscore(mapper.name), def.foreignKey, opts))
        } else {
          tasks.push(self.waitForIndex(relationDef.table || underscore(relationDef.name), def.foreignKey, opts))
        }
      }
    })
    return Promise.all(tasks).then(function () {
      // beforeFind lifecycle hook
      op = opts.op = 'beforeFind'
      return resolve(self[op](mapper, id, opts)).then(function () {
        op = opts.op = 'find'
        self.dbg(op, id, opts)
        return self.selectTable(mapper, opts).get(id).run()
      })
    }).then(function (_record) {
      if (!_record) {
        return
      }
      record = _record
      const tasks = []

      forEachRelation(mapper, opts, function (def, __opts) {
        const relatedMapper = def.getRelation()
        let task

        if (def.foreignKey && (def.type === 'hasOne' || def.type === 'hasMany')) {
          if (def.type === 'hasOne') {
            task = self.loadHasOne(mapper, def, record, __opts)
          } else {
            task = self.loadHasMany(mapper, def, record, __opts)
          }
        } else if (def.type === 'hasMany' && def.localKeys) {
          let localKeys = []
          let itemKeys = get(record, def.localKeys) || []
          itemKeys = isArray(itemKeys) ? itemKeys : Object.keys(itemKeys)
          localKeys = localKeys.concat(itemKeys)
          task = self.findAll(relatedMapper, {
            where: {
              [relatedMapper.idAttribute]: {
                'in': unique(localKeys).filter(function (x) { return x })
              }
            }
          }, __opts).then(function (relatedItems) {
            def.setLocalField(record, relatedItems)
          })
        } else if (def.type === 'hasMany' && def.foreignKeys) {
          task = self.findAll(relatedMapper, {
            where: {
              [def.foreignKeys]: {
                'contains': get(record, mapper.idAttribute)
              }
            }
          }, __opts).then(function (relatedItems) {
            def.setLocalField(record, relatedItems)
          })
        } else if (def.type === 'belongsTo') {
          task = self.loadBelongsTo(mapper, def, record, __opts)
        }
        if (task) {
          tasks.push(task)
        }
      })

      return Promise.all(tasks)
    }).then(function () {
      // afterFind lifecycle hook
      op = opts.op = 'afterFind'
      return resolve(self[op](mapper, id, opts, record)).then(function (_record) {
        // Allow for re-assignment from lifecycle hook
        record = isUndefined(_record) ? record : _record
        return self.getRaw(opts) ? {
          data: record,
          found: record ? 1 : 0
        } : record
      })
    })
  },

  /**
   * Retrieve the records that match the selection query.
   *
   * @name RethinkDBAdapter#findAll
   * @method
   * @param {Object} mapper The mapper.
   * @param {Object} query Selection query.
   * @param {Object} [opts] Configuration options.
   * @param {boolean} [opts.raw=false] TODO
   * @param {string[]} [opts.with=[]] TODO
   * @return {Promise}
   */
  findAll (mapper, query, opts) {
    const self = this
    opts || (opts = {})
    opts.with || (opts.with = [])

    let records = []
    let op
    const table = mapper.table || underscore(mapper.name)
    const relationList = mapper.relationList || []
    let tasks = [self.waitForTable(table, opts)]

    relationList.forEach(function (def) {
      const relationName = def.relation
      const relationDef = def.getRelation()
      if (!opts.with || opts.with.indexOf(relationName) === -1) {
        return
      }
      if (def.foreignKey && def.type !== 'belongsTo') {
        if (def.type === 'belongsTo') {
          tasks.push(self.waitForIndex(mapper.table || underscore(mapper.name), def.foreignKey, opts))
        } else {
          tasks.push(self.waitForIndex(relationDef.table || underscore(relationDef.name), def.foreignKey, opts))
        }
      }
    })
    return Promise.all(tasks).then(function () {
      // beforeFindAll lifecycle hook
      op = opts.op = 'beforeFindAll'
      return resolve(self[op](mapper, query, opts))
    }).then(function () {
      op = opts.op = 'findAll'
      self.dbg(op, query, opts)
      return self.filterSequence(self.selectTable(mapper, opts), query).run()
    }).then(function (_records) {
      records = _records
      const tasks = []
      forEachRelation(mapper, opts, function (def, __opts) {
        const relatedMapper = def.getRelation()
        const idAttribute = mapper.idAttribute
        let task
        if (def.foreignKey && (def.type === 'hasOne' || def.type === 'hasMany')) {
          if (def.type === 'hasMany') {
            task = self.loadHasMany(mapper, def, records, __opts)
          } else {
            task = self.loadHasOne(mapper, def, records, __opts)
          }
        } else if (def.type === 'hasMany' && def.localKeys) {
          let localKeys = []
          records.forEach(function (item) {
            let itemKeys = item[def.localKeys] || []
            itemKeys = isArray(itemKeys) ? itemKeys : Object.keys(itemKeys)
            localKeys = localKeys.concat(itemKeys)
          })
          task = self.findAll(relatedMapper, {
            where: {
              [relatedMapper.idAttribute]: {
                'in': unique(localKeys).filter(function (x) { return x })
              }
            }
          }, __opts).then(function (relatedItems) {
            records.forEach(function (item) {
              let attached = []
              let itemKeys = get(item, def.localKeys) || []
              itemKeys = isArray(itemKeys) ? itemKeys : Object.keys(itemKeys)
              relatedItems.forEach(function (relatedItem) {
                if (itemKeys && itemKeys.indexOf(relatedItem[relatedMapper.idAttribute]) !== -1) {
                  attached.push(relatedItem)
                }
              })
              def.setLocalField(item, attached)
            })
            return relatedItems
          })
        } else if (def.type === 'hasMany' && def.foreignKeys) {
          task = self.findAll(relatedMapper, {
            where: {
              [def.foreignKeys]: {
                'isectNotEmpty': records.map(function (record) {
                  return get(record, idAttribute)
                })
              }
            }
          }, __opts).then(function (relatedItems) {
            const foreignKeysField = def.foreignKeys
            records.forEach(function (record) {
              const _relatedItems = []
              const id = get(record, idAttribute)
              relatedItems.forEach(function (relatedItem) {
                const foreignKeys = get(relatedItems, foreignKeysField) || []
                if (foreignKeys.indexOf(id) !== -1) {
                  _relatedItems.push(relatedItem)
                }
              })
              def.setLocalField(record, _relatedItems)
            })
          })
        } else if (def.type === 'belongsTo') {
          task = self.loadBelongsTo(mapper, def, records, __opts)
        }
        if (task) {
          tasks.push(task)
        }
      })
      return Promise.all(tasks)
    }).then(function () {
      // afterFindAll lifecycle hook
      op = opts.op = 'afterFindAll'
      return resolve(self[op](mapper, query, opts, records)).then(function (_records) {
        // Allow for re-assignment from lifecycle hook
        records = isUndefined(_records) ? records : _records
        return self.getRaw(opts) ? {
          data: records,
          found: records.length
        } : records
      })
    })
  },

  /**
   * TODO
   *
   * @name RethinkDBAdapter#getRaw
   * @method
   */
  getRaw (opts) {
    opts || (opts = {})
    return !!(isUndefined(opts.raw) ? this.raw : opts.raw)
  },

  /**
   * TODO
   *
   * @name RethinkDBAdapter#log
   * @method
   */
  log (level, ...args) {
    if (level && !args.length) {
      args.push(level)
      level = 'debug'
    }
    if (level === 'debug' && !this.debug) {
      return
    }
    const prefix = `${level.toUpperCase()}: (RethinkDBAdapter)`
    if (console[level]) {
      console[level](prefix, ...args)
    } else {
      console.log(prefix, ...args)
    }
  },

  /**
   * Apply the given update to the record with the specified primary key.
   *
   * @name RethinkDBAdapter#update
   * @method
   * @param {Object} mapper The mapper.
   * @param {(string|number)} id The primary key of the record to be updated.
   * @param {Object} props The update to apply to the record.
   * @param {Object} [opts] Configuration options.
   * @param {boolean} [opts.raw=false] TODO
   * @return {Promise}
   */
  update (mapper, id, props, opts) {
    const self = this
    props || (props = {})
    opts || (opts = {})
    let op

    return self.waitForTable(mapper.table || underscore(mapper.name), opts).then(function () {
      // beforeUpdate lifecycle hook
      op = opts.op = 'beforeUpdate'
      return resolve(self[op](mapper, id, props, opts))
    }).then(function (_props) {
      // Allow for re-assignment from lifecycle hook
      _props = isUndefined(_props) ? props : _props
      return self.selectTable(mapper, opts).get(id).update(_props, { returnChanges: true }).run()
    }).then(function (cursor) {
      let record
      self._handleErrors(cursor)
      if (cursor && cursor.changes && cursor.changes.length && cursor.changes[0].new_val) {
        record = cursor.changes[0].new_val
      } else {
        throw new Error('Not Found')
      }

      // afterUpdate lifecycle hook
      op = opts.op = 'afterUpdate'
      return resolve(self[op](mapper, id, props, opts, record)).then(function (_record) {
        // Allow for re-assignment from lifecycle hook
        record = isUndefined(_record) ? record : _record
        const result = {}
        fillIn(result, cursor)
        result.data = record
        result.updated = record ? 1 : 0
        return self.getRaw(opts) ? result : result.data
      })
    })
  },

  /**
   * Apply the given update to all records that match the selection query.
   *
   * @name RethinkDBAdapter#updateAll
   * @method
   * @param {Object} mapper The mapper.
   * @param {Object} props The update to apply to the selected records.
   * @param {Object} [query] Selection query.
   * @param {Object} [opts] Configuration options.
   * @param {boolean} [opts.raw=false] TODO
   * @return {Promise}
   */
  updateAll (mapper, props, query, opts) {
    const self = this
    props || (props = {})
    query || (query = {})
    opts || (opts = {})
    let op

    return self.waitForTable(mapper.table || underscore(mapper.name), opts).then(function () {
      // beforeUpdateAll lifecycle hook
      op = opts.op = 'beforeUpdateAll'
      return resolve(self[op](mapper, props, query, opts))
    }).then(function (_props) {
      // Allow for re-assignment from lifecycle hook
      _props = isUndefined(_props) ? props : _props
      return self.filterSequence(self.selectTable(mapper, opts), query).update(_props, { returnChanges: true }).run()
    }).then(function (cursor) {
      let records = []
      self._handleErrors(cursor)
      if (cursor && cursor.changes && cursor.changes.length) {
        records = cursor.changes.map(function (change) { return change.new_val })
      }
      // afterUpdateAll lifecycle hook
      op = opts.op = 'afterUpdateAll'
      return self[op](mapper, props, query, opts, records).then(function (_records) {
        // Allow for re-assignment from lifecycle hook
        records = isUndefined(_records) ? records : _records
        const result = {}
        fillIn(result, cursor)
        result.data = records
        result.updated = records.length
        return self.getRaw(opts) ? result : result.data
      })
    })
  },

  /**
   * Update the given records in a single batch.
   *
   * @name RethinkDBAdapter#updateMany
   * @method
   * @param {Object} mapper The mapper.
   * @param {Object[]} records The records to update.
   * @param {Object} [opts] Configuration options.
   * @param {boolean} [opts.raw=false] TODO
   * @return {Promise}
   */
  updateMany (mapper, records, opts) {
    const self = this
    records || (records = [])
    opts || (opts = {})
    let op
    const idAttribute = mapper.idAttribute

    records = records.filter(function (record) {
      return get(record, idAttribute)
    })

    return self.waitForTable(mapper.table || underscore(mapper.name), opts).then(function () {
      // beforeUpdateMany lifecycle hook
      op = opts.op = 'beforeUpdateMany'
      return resolve(self[op](mapper, records, opts))
    }).then(function (_records) {
      // Allow for re-assignment from lifecycle hook
      _records = isUndefined(_records) ? records : _records
      return self.selectTable(mapper, opts).insert(_records, { returnChanges: true, conflict: 'update' }).run()
    }).then(function (cursor) {
      let updatedRecords
      self._handleErrors(cursor)
      if (cursor && cursor.changes && cursor.changes.length) {
        updatedRecords = cursor.changes.map(function (change) { return change.new_val })
      }

      // afterUpdateMany lifecycle hook
      op = opts.op = 'afterUpdateMany'
      return resolve(self[op](mapper, records, opts, updatedRecords)).then(function (_records) {
        // Allow for re-assignment from lifecycle hook
        records = isUndefined(_records) ? updatedRecords : _records
        const result = {}
        fillIn(result, cursor)
        result.data = records
        result.updated = records.length
        return self.getRaw(opts) ? result : result.data
      })
    })
  },

  waitForTable (table, options) {
    options = options || {}
    let db = isUndefined(options.db) ? this.db : options.db
    return this.waitForDb(options).then(() => {
      this.tables[db] = this.tables[db] || {}
      if (!this.tables[db][table]) {
        this.tables[db][table] = this.r.branch(this.r.db(db).tableList().contains(table), true, this.r.db(db).tableCreate(table)).run()
      }
      return this.tables[db][table]
    })
  },

  waitForIndex (table, index, options) {
    options = options || {}
    let db = isUndefined(options.db) ? this.db : options.db
    return this.waitForDb(options).then(() => this.waitForTable(table, options)).then(() => {
      this.indices[db] = this.indices[db] || {}
      this.indices[db][table] = this.indices[db][table] || {}
      if (!this.tables[db][table][index]) {
        this.tables[db][table][index] = this.r.branch(this.r.db(db).table(table).indexList().contains(index), true, this.r.db(db).table(table).indexCreate(index)).run().then(() => {
          return this.r.db(db).table(table).indexWait(index).run()
        })
      }
      return this.tables[db][table][index]
    })
  }
})
