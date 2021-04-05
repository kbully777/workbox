/*
  Copyright 2018 Google LLC

  Use of this source code is governed by an MIT-style
  license that can be found in the LICENSE file or at
  https://opensource.org/licenses/MIT.
*/

import {assert} from 'workbox-core/_private/assert.js';
import '../_version.js';
import {UnidentifiedQueueStoreEntry, QueueStoreEntry, QueueDb} from './QueueDb';

/**
 * A class to manage storing requests from a Queue in IndexedDB,
 * indexed by their queue name for easier access.
 *
 * @private
 */
export class QueueStore {
  private readonly _queueName: string;
  private readonly _queueDb: QueueDb;

  /**
   * Associates this instance with a Queue instance, so entries added can be
   * identified by their queue name.
   *
   * @param {string} queueName
   * @private
   */
  constructor(queueName: string) {
    this._queueName = queueName;
    this._queueDb = new QueueDb();
  }

  /**
   * Append an entry last in the queue.
   *
   * @param {Object} entry
   * @param {Object} entry.requestData
   * @param {number} [entry.timestamp]
   * @param {Object} [entry.metadata]
   * @private
   */
  async pushEntry(entry: UnidentifiedQueueStoreEntry) {
    if (process.env.NODE_ENV !== 'production') {
      assert!.isType(entry, 'object', {
        moduleName: 'workbox-background-sync',
        className: 'QueueStore',
        funcName: 'pushEntry',
        paramName: 'entry',
      });
      assert!.isType(entry.requestData, 'object', {
        moduleName: 'workbox-background-sync',
        className: 'QueueStore',
        funcName: 'pushEntry',
        paramName: 'entry.requestData',
      });
    }

    // Don't specify an ID since one is automatically generated.
    delete entry.id;
    entry.queueName = this._queueName;

    await this._queueDb.addEntry(entry);
  }

  /**
   * Prepend an entry first in the queue.
   *
   * @param {Object} entry
   * @param {Object} entry.requestData
   * @param {number} [entry.timestamp]
   * @param {Object} [entry.metadata]
   * @private
   */
  async unshiftEntry(entry: UnidentifiedQueueStoreEntry) {
    if (process.env.NODE_ENV !== 'production') {
      assert!.isType(entry, 'object', {
        moduleName: 'workbox-background-sync',
        className: 'QueueStore',
        funcName: 'unshiftEntry',
        paramName: 'entry',
      });
      assert!.isType(entry.requestData, 'object', {
        moduleName: 'workbox-background-sync',
        className: 'QueueStore',
        funcName: 'unshiftEntry',
        paramName: 'entry.requestData',
      });
    }

    const firstEntry = await this._queueDb.getFirstEntry();

    if (firstEntry) {
      // Pick an ID one less than the lowest ID in the object store.
      entry.id = firstEntry.id - 1;
    } else {
      // Otherwise let the auto-incrementor assign the ID.
      delete entry.id;
    }
    entry.queueName = this._queueName;

    await this._queueDb.addEntry(entry);
  }

  /**
   * Removes and returns the last entry in the queue matching the `queueName`.
   *
   * @return {Promise<Object>}
   * @private
   */
  async popEntry(): Promise<QueueStoreEntry> {
    return this._removeEntry({direction: 'prev'});
  }

  /**
   * Removes and returns the first entry in the queue matching the `queueName`.
   *
   * @return {Promise<Object>}
   * @private
   */
  async shiftEntry(): Promise<QueueStoreEntry> {
    return this._removeEntry({direction: 'next'});
  }

  /**
   * Returns all entries in the store matching the `queueName`.
   *
   * @param {Object} options See {@link module:workbox-background-sync.Queue~getAll}
   * @return {Promise<Array<Object>>}
   * @private
   */
  async getAll(): Promise<QueueStoreEntry[] | any> {
    return await this._queueDb.getAllEntriesFromIndex(
      IDBKeyRange.only(this._queueName),
    );
  }

  /**
   * Deletes the entry for the given ID.
   *
   * WARNING: this method does not ensure the deleted enry belongs to this
   * queue (i.e. matches the `queueName`). But this limitation is acceptable
   * as this class is not publicly exposed. An additional check would make
   * this method slower than it needs to be.
   *
   * @private
   * @param {number} id
   */
  async deleteEntry(id: number) {
    await this._queueDb.deleteEntry(id);
  }

  /**
   * Removes and returns the first or last entry in the queue (based on the
   * `direction` argument) matching the `queueName`.
   *
   * @return {Promise<Object>}
   * @private
   */
  async _removeEntry({direction}: {direction?: IDBCursorDirection}) {
    const entry = await this._queueDb.getEndEntryFromIndex(
      {direction},
      IDBKeyRange.only(this._queueName),
    );

    if (entry) {
      await this.deleteEntry(entry.id);
      return entry;
    }
  }
}
