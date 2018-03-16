const crawler = require('./xiami_crawler')

class Song {
  constructor (id) {
    this.id = id
  }

  content () {
    return this.constructor.getContent(this.id)
  }

  tracklist () {
    return this.constructor.getTracklist([ this.id ])
  }

  static getContent (id) {
    return crawler.getSongContent(id)
  }

  static getTracklist (ids) {
    return crawler.getSongsTracklist(ids)
  }

  static getHQAudioURL (id) {
    return crawler.getSongHQAudioURL(id)
  }

  static search (keyword, page = 1) {
    return crawler.searchSongs(keyword, page)
  }
}

module.exports = {
  Song
}
