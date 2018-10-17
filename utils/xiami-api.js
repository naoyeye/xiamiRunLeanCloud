const xiamiSong = require('./xiami-song')

class Song {
  constructor (id) {
    this.id = id
  }

  content () {
    return this.constructor.getContent(this.id)
  }

  static getContent (id) {
    return xiamiSong.getSongContent(id)
  }

}

module.exports = {
  Song
}
