const http = require('http')
const https = require('https')
const _URL = require('url')
const cheerio = require('cheerio')
const querystring = require('querystring')
const xml2js = require('xml2js')

const MAX_SEARCH_ARTISTS_PAGE_ITEMS = 30
const MAX_SEARCH_SONGS_PAGE_ITEMS = 20
const MAX_SEARCH_ALBUMS_PAGE_ITEMS = 30
const MAX_SEARCH_FEATURED_COLLECTIONS_PAGE_ITEMS = 30

const MAX_ARTIST_ALBUMS_PAGE_ITEMS = 12
const MAX_ARTIST_TOP100_PAGE_ITEMS = 20
const MAX_USER_FAVORED_SONGS_PAGE_ITEMS = 25
const MAX_USER_FAVORED_ALBUMS_PAGE_ITEMS = 15
const MAX_USER_FAVORED_ARTISTS_PAGE_ITEMS = 15

const TRACKLIST_TYPE_SONG = 0
const TRACKLIST_TYPE_ALBUM = 1
const TRACKLIST_TYPE_ARTIST = 2
const TRACKLIST_TYPE_FEATURED_COLLECTION = 3
const TRACKLIST_TYPE_DAILY_RECOMMENDED = 9

const RADIO_TRACKLIST_TYPE_USER = 4
const RADIO_TRACKLIST_TYPE_ARTIST = 5

const FAVORITE_TYPE_SONG = 3
const FAVORITE_TYPE_ALBUM = 5
const FAVORITE_TYPE_FEATURED_COLLECTION = 4
const FAVORITE_TYPE_ARTIST = 6

function _editorTextFormatToString (text) {
  return text.replace(/\t/g, '').replace(/\r/g, '')
}

function _decodeLocation (location) {
  let loc2 = parseInt(location.substr(0, 1))
  let loc3 = location.substr(1)
  let loc4 = Math.floor(loc3.length / loc2)
  let loc5 = loc3.length % loc2
  let loc6 = []
  let loc7 = 0
  let loc8 = ''
  let loc9 = ''
  let loc10 = ''
  while (loc7 < loc5) {
    loc6[loc7] = loc3.substr((loc4 + 1) * loc7, loc4 + 1)
    loc7++
  }
  loc7 = loc5
  while (loc7 < loc2) {
    loc6[loc7] = loc3.substr(loc4 * (loc7 - loc5) + (loc4 + 1) * loc5, loc4)
    loc7++
  }
  loc7 = 0
  while (loc7 < loc6[0].length) {
    loc10 = 0
    while (loc10 < loc6.length) {
      loc8 += loc6[loc10][loc7] !== undefined ? loc6[loc10][loc7] : ''
      loc10++
    }
    loc7++
  }

  loc9 = decodeURIComponent(loc8).replace(/\^/g, '0')
  return loc9
}

function getFeaturedCollectionContent (id, userToken = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.xiami.com',
      path: `/collect/${id}`,
      headers: {
        'Cookie': userToken !== null ? `member_auth=${userToken}` : ''
      }
    }

    http.get(options, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const $ = cheerio.load(rawData)

        const title = $('h2').clone().children().remove().end().text().trim()
        const tracklist = []

        let avatarURL = $('.collect_cover > img').attr('src').replace(/@.*$/, '')
        avatarURL = avatarURL.match(/\/\/pic\.xiami.net\/images\/default\/avatar/) !== null ? null : _URL.parse(avatarURL)

        const author = {
          id: parseInt($('h4 > a').attr('name_card')),
          name: $('h4 > a').text().trim(),
          avatarURL
        }
        const introduction = _editorTextFormatToString($('.info_intro_full').text().trim())
        const id = parseInt($('#qrcode > span').text())

        let coverURL = $('.bigImgCover > img').attr('src').replace(/@.*$/, '')
        coverURL = coverURL === 'http://pic.xiami.net/res/img/default/collect_default_cover.png' ? null : _URL.parse(coverURL)

        $('.quote_song_list > ul > li').each((_, element) => {
          const $element = $(element)
          const $input = $element.find('input[type="checkbox"]')

          const id = parseInt($input.attr('value'))
          const canBePlayed = $input.is(':checked')
          const title = canBePlayed
                          ? $element.find('.song_toclt').attr('title').trim().match(/^添加(.*)到歌单$/)[1]
                          : $element.find('.song_name').text().trim().match(/^.*(?=\s*--)/)[0].trim()
          const artists = []
          let introduction = _editorTextFormatToString($element.find('#des_').text().trim())
          introduction = introduction === '' ? null : introduction

          $element.find('.song_name > a[href^="/artist/"], .song_name > a[href^="http://www.xiami.com/search/find"]').each((_, element) => {
            const $element = $(element)
            const href = $element.attr('href')

            const name = $element.text().trim()
            const id = href.match(/^http:\/\/www\.xiami\.com\/search\/find.*/) !== null ? null : href.match(/\w+$/)[0]
            artists.push({ name, id })
          })

          tracklist.push({ id, title, artists, introduction, canBePlayed })
        })

        resolve({
          id,
          title,
          author,
          introduction,
          tracklist,
          coverURL,
          isFavorite: $('#collect_removefav_').css('display') !== 'none'
        })
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function getArtistIdByName (name) {
  return new Promise((resolve, reject) => {
    http.get(`http://www.xiami.com/search/find?artist=${encodeURIComponent(name)}`, (res) => {
      const { statusCode, headers } = res

      let error
      if (statusCode !== 301 && statusCode !== 302) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      if (statusCode === 302) {
        resolve(null)
        res.resume()
      } else {
        resolve(headers.location.match(/\w+$/)[0])
        res.resume()
      }
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function searchArtists (keyword, page = 1) {
  if (page < 1) throw new Error('Argument `page` must more than or equal to 1')
  return new Promise((resolve, reject) => {
    http.get(`http://www.xiami.com/search/artist/page/${page}?key=${encodeURIComponent(keyword)}`, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const $ = cheerio.load(rawData)

        const total = parseInt($('.seek_counts.ok > b:first-child').text().trim())
        if (total === 0) {
          resolve(null)
          return
        }

        const data = []
        const lastPage = Math.ceil(total / MAX_SEARCH_ARTISTS_PAGE_ITEMS)
        if (page > lastPage) {
          resolve(null)
          return
        }

        $('.artistBlock_list > ul > li').each((_, element) => {
          const $element = $(element)
          const $title = $element.find('.title')

          const name = $title.attr('title')
          let aliases = $title.find('.singer_names').text().trim().match(/^\((.*)\)$/)
          aliases = aliases === null ? [] : aliases[1].split(' / ')
          const id = $title.attr('href').match(/\w+$/)[0]
          const photoURL = _URL.parse($element.find('.artist100 > img').attr('src').replace(/@.*$/, ''))

          data.push({ id, name, aliases, photoURL })
        })

        resolve({ total, lastPage, page, data })
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function getArtistIdBySearch (keyword) {
  return new Promise((resolve, reject) => {
    searchArtists(keyword).then((result) => {
      if (result === null) {
        resolve(null)
        return
      }
      resolve(result.data[0].id)
    }).catch((e) => {
      reject(e)
    })
  })
}

function getArtistIdByNameOrSearch (nameOrKeyword) {
  return new Promise((resolve, reject) => {
    getArtistIdByName(nameOrKeyword).then((id) => {
      if (id !== null) {
        resolve(id)
        return
      }

      getArtistIdBySearch(nameOrKeyword).then((id) => {
        if (id === null) {
          resolve(null)
          return
        }

        resolve(id)
      }).catch((e) => {
        reject(e)
      })
    }).catch((e) => {
      reject(e)
    })
  })
}

function getArtistProfile (id) {
  return new Promise((resolve, reject) => {
    const query = (id) => {
      http.get(`http://www.xiami.com/artist/profile-${id}`, (res) => {
        const { statusCode } = res

        let error
        if (statusCode !== 200) {
          error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
        }
        if (error) {
          res.resume()
          reject(error)
          return
        }

        res.setEncoding('utf8')
        let rawData = ''
        res.on('data', (chunk) => { rawData += chunk })
        res.on('end', () => {
          const $ = cheerio.load(rawData)
          const $name = $('#artist_profile > .content > p > a')
          const introduction = _editorTextFormatToString($('#main > .profile').text())
          const name = $name.clone().children().remove().end().text().trim()
          let aliases = $name.find('span').text().trim()
          aliases = aliases === '' ? [] : aliases.split(' / ')

          resolve({ id, introduction, name, aliases })
        })
      }).on('error', (e) => {
        reject(e)
      })
    }

    if (typeof id === 'string') {
      convertArtistStringIdToNumberId(id).then((id) => {
        query(id)
      }).catch((e) => {
        reject(e)
      })
    } else {
      query(id)
    }
  })
}

function getArtistAlbums (id, page = 1) {
  if (page < 1) throw new Error('Argument `page` must more than or equal to 1')
  return new Promise((resolve, reject) => {
    http.get(`http://www.xiami.com/artist/album-${id}?page=${page}`, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const $ = cheerio.load(rawData)
        const total = parseInt($('.cate_viewmode .counts').text().match(/\d+/)[0])
        if (total === 0) {
          resolve(null)
          return
        }

        const data = []
        const lastPage = Math.ceil(total / MAX_ARTIST_ALBUMS_PAGE_ITEMS)

        $('.albumThread_list > ul > li').each((_, element) => {
          const $element = $(element)
          const $name = $element.find('.name')
          const $title = $name.find('a')

          const title = $title.attr('title').trim()
          let subtitle = $name.clone().children().remove().end().text().trim().match(/^\((.*)\)$/)
          subtitle = subtitle === null ? subtitle : subtitle[1]
          const id = parseInt($element.find('.album_item100_thread').attr('id').match(/\d+$/)[0])
          const coverURL = _URL.parse($element.find('.CDcover100 > img').attr('src').replace(/@.*$/, ''))

          data.push({ id, title, subtitle, coverURL })
        })

        resolve({ total, lastPage, page, data })
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function getArtistTop100Songs (id, page = 1) {
  if (page < 1) throw new Error('Argument `page` must more than or equal to 1')
  return new Promise((resolve, reject) => {
    http.get(`http://www.xiami.com/artist/top-${id}?page=${page}`, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const $ = cheerio.load(rawData)
        const total = parseInt($('.all_page > span').text().match(/(\d+).{2}$/)[1])
        if (total === 0) {
          resolve(null)
          return
        }

        const data = []
        const lastPage = Math.ceil(total / MAX_ARTIST_TOP100_PAGE_ITEMS)
        if (page > lastPage) {
          resolve(null)
          return
        }

        $('.track_list > tbody > tr').each((_, element) => {
          const $element = $(element)
          const $name = $element.find('.song_name > a')

          const title = $name.attr('title').trim()
          const id = parseInt($element.find('input[type="checkbox"]').attr('value'))
          data.push({ id, title })
        })

        resolve({ total, lastPage, page, data })
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function convertArtistStringIdToNumberId (stringId) {
  return new Promise((resolve, reject) => {
    http.get(`http://www.xiami.com/artist/similar-${stringId}`, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const $ = cheerio.load(rawData)
        const id = parseInt($('.acts > a').attr('href').match(/\d+$/)[0])

        resolve(id)
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function getAlbumContent (id, userToken = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.xiami.com',
      path: `/album/${id}`,
      headers: {
        'Cookie': userToken !== null ? `member_auth=${userToken}` : ''
      }
    }

    http.get(options, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const $ = cheerio.load(rawData)
        const $title = $('h1')
        const $artist = $('#album_info table tr:first-of-type a')

        const id = parseInt($('#qrcode > .acts').text())
        const title = $title.clone().children().remove().end().text().trim()

        let subtitle = $title.find('span').text().trim()
        subtitle = subtitle === '' ? null : subtitle

        const tracklist = []
        $('#track_list tr[data-needpay]').each((_, element) => {
          const $element = $(element)
          const $input = $element.find('input[type="checkbox"]')
          const $name = $element.find('.song_name')

          const id = parseInt($input.attr('value'))
          const canBePlayed = $input.is(':checked')
          const title = $name.find('a:first-of-type').text().trim()
          let subtitle = $name.find('a:nth-of-type(2)').text().trim()
          subtitle = subtitle === '' ? null : subtitle

          tracklist.push({ id, canBePlayed, title, subtitle })
        })

        const artist = {
          id: parseInt($('#other_albums > .acts > a.more').attr('href').match(/\d+$/)[0]),
          name: $artist.text().trim()
        }

        let coverURL = $('#cover_lightbox > img').attr('src').replace(/@.*$/, '')
        coverURL = coverURL.match(/\/\/pic\.xiami.net\/images\/default\//) !== null ? null : _URL.parse(coverURL)
        const introduction = _editorTextFormatToString($('[property="v:summary"]').text().trim())

        const isFavorite = $(`#album_removefav_${id}`).css('display') !== 'none'

        resolve({ id, title, subtitle, tracklist, artist, coverURL, introduction, isFavorite })
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function getSongContent (id, userToken = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.xiami.com',
      path: `/song/${id}`,
      headers: {
        'Cookie': userToken !== null ? `member_auth=${userToken}` : ''
      }
    }

    http.get(options, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const $ = cheerio.load(rawData)
        const id = parseInt($('#qrcode .acts').text())
        const title = $('h1').clone().children().remove().end().text().trim()

        let subtitle = $('h1 > span').text().trim()
        subtitle = subtitle === '' ? null : subtitle

        const album = {
          id: parseInt($('#albumCover').attr('href').match(/\d+$/)[0]),
          title: $('#albums_info tr:first-of-type a').text().trim(),
          coverURL: _URL.parse($('#albumCover').find('img').attr('src').replace(/@.*$/, ''))
        }

        const artists = []
        $('#albums_info tr:nth-of-type(2) a').each((_, element) => {
          const $element = $(element)
          const id = $element.attr('href').match(/\w+$/)[0]
          const name = $element.text().trim()

          artists.push({ id, name })
        })

        const isFavorite = $(`#song_removefav_${id}`).css('display') !== 'none'

        resolve({ id, title, subtitle, album, artists, isFavorite })
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function getTracklist (type, id, userToken = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.xiami.com',
      path: `/song/playlist/id/${id}/type/${type}/cat/json`,
      headers: {
        'Cookie': userToken !== null ? `member_auth=${userToken}` : ''
      }
    }

    http.get(options, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const parsedData = JSON.parse(rawData)
        const tracklist = []

        if (parsedData.data.trackList === null || parsedData.data.trackList === undefined) {
          resolve(tracklist)
          return
        }

        for (const songData of parsedData.data.trackList) {
          const artists = []
          for (const artistData of songData.singersSource) {
            artists.push({ id: artistData.artistId, name: artistData.artistName })
          }

          let albumCoverURL = songData.album_pic
          albumCoverURL = albumCoverURL.match(/\/\/img\.xiami.net\/images\/default\//) !== null ? null : _URL.parse(albumCoverURL)

          tracklist.push({
            id: parseInt(songData.songId),
            title: songData.songName,
            subtitle: songData.subName === '' ? null : songData.subName,
            album: {
              id: songData.albumId,
              coverURL: albumCoverURL,
              title: songData.album_name
            },
            artists,
            audioURL: _URL.parse(_decodeLocation(songData.location)),
            lyricURL: songData.lyric_url === '' ? null : _URL.parse(songData.lyric_url),
            isFavorite: songData.grade === 1
          })
        }
        resolve(tracklist)
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function getSongsTracklist (ids, userToken = null) {
  return new Promise((resolve, reject) => {
    getTracklist(TRACKLIST_TYPE_SONG, encodeURIComponent(ids.join()), userToken).then((tracklist) => {
      resolve(tracklist)
    }).catch((e) => {
      reject(e)
    })
  })
}

function getArtistTracklist (id, userToken = null) {
  return getTracklist(TRACKLIST_TYPE_ARTIST, id, userToken)
}

function getAlbumTracklist (id, userToken = null) {
  return getTracklist(TRACKLIST_TYPE_ALBUM, id, userToken)
}

function getFeaturedCollectionTracklist (id, userToken = null) {
  return getTracklist(TRACKLIST_TYPE_FEATURED_COLLECTION, id, userToken)
}

function getSongHQAudioURL (id) {
  return new Promise((resolve, reject) => {
    http.get({
      hostname: 'www.xiami.com',
      path: `/song/gethqsong/sid/${id}`,
      headers: {
        'Referer': 'http://www.xiami.com/'
      }
    }, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const parsedData = JSON.parse(rawData)
        let audioURL = null
        let success = true
        let url = null
        if (parsedData.status === 1 && parsedData.location !== '') {
          audioURL = _URL.parse(_decodeLocation(parsedData.location))

          // patch
          url = audioURL.href

        }
        if (url) {
          resolve({ success, url })
        } else {
          success = false
          resolve({ success, url })
        }
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function getUserFavoredSongs (id, page = 1) {
  if (page < 1) throw new Error('Argument `page` must more than or equal to 1')
  return new Promise((resolve, reject) => {
    http.get(`http://www.xiami.com/space/lib-song/u/${id}/page/${page}`, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const $ = cheerio.load(rawData)
        const total = parseInt($('.counts').text().match(/\d+/)[0])
        if (total === 0) {
          resolve(null)
          return
        }

        const data = []
        const lastPage = Math.ceil(total / MAX_USER_FAVORED_SONGS_PAGE_ITEMS)
        if (page > lastPage) {
          resolve(null)
          return
        }

        $('.track_list > tbody > tr').each((_, element) => {
          const $element = $(element)
          const $input = $element.find('input[type="checkbox"]')
          const $name = $element.find('.song_name')

          const id = parseInt($input.attr('value'))
          const title = $name.find('a:first-of-type').text().trim()
          const canBePlayed = $input.is(':checked')

          const artists = []
          $name.find('.artist_name').each((_, element) => {
            const $element = $(element)
            const href = $element.attr('href')

            const name = $element.attr('title').trim()
            const id = href.match(/^http:\/\/www\.xiami\.com\/search\/find.*/) !== null ? null : href.match(/\w+$/)[0]
            artists.push({ id, name })
          })

          data.push({ id, canBePlayed, title, artists })
        })

        resolve({ total, lastPage, page, data })
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function getUserFavoredAlbums (id, page = 1) {
  if (page < 1) throw new Error('Argument `page` must more than or equal to 1')
  return new Promise((resolve, reject) => {
    http.get(`http://www.xiami.com/space/lib-album/u/${id}/page/${page}`, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const $ = cheerio.load(rawData)
        const total = parseInt($('.counts').text().match(/\d+/)[0])
        if (total === 0) {
          resolve(null)
          return
        }

        const data = []
        const lastPage = Math.ceil(total / MAX_USER_FAVORED_ALBUMS_PAGE_ITEMS)
        if (page > lastPage) {
          resolve(null)
          return
        }

        $('.albumThread_list > ul > li').each((_, element) => {
          const $element = $(element)
          const $cover = $element.find('.CDcover100 > img')
          const $artist = $element.find('.name a[href^="/artist/"]')

          const id = parseInt($element.find('.album_item100_thread').attr('rel'))
          const coverURL = _URL.parse($cover.attr('src').replace(/@.*$/, ''))
          const title = $cover.attr('alt').trim()
          const artist = {
            id: $artist.attr('href').match(/\w+$/)[0],
            name: $artist.attr('title').trim()
          }

          data.push({ id, title, coverURL, artist })
        })

        resolve({ total, lastPage, page, data })
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function getUserFavoredFeaturedCollections (id, page = 1) {
  if (page < 1) throw new Error('Argument `page` must more than or equal to 1')
  return new Promise((resolve, reject) => {
    http.get(`http://www.xiami.com/space/collect-fav/u/${id}/page/${page}`, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const $ = cheerio.load(rawData)
        const total = parseInt($('.counts').text().match(/\d+/)[0])
        if (total === 0) {
          resolve(null)
          return
        }

        const data = []
        const lastPage = Math.ceil(total / MAX_USER_FAVORED_ALBUMS_PAGE_ITEMS)
        if (page > lastPage) {
          resolve(null)
          return
        }

        $('.collectThread_list > ul > li').each((_, element) => {
          const $element = $(element)
          const $cover = $element.find('.cover img')
          const $author = $element.find('.author > a')

          let coverURL = $cover.attr('src').replace(/@.*$/, '')
          coverURL = coverURL === 'http://pic.xiami.net/res/img/default/collect_default_cover.png' ? null : _URL.parse(coverURL)

          const title = $cover.attr('alt').trim()
          const id = parseInt($element.attr('id').match(/\d+/)[0])
          const author = {
            id: parseInt($author.attr('href').match(/\d+/)[0]),
            name: $author.text().trim()
          }

          data.push({ id, title, coverURL, author })
        })

        resolve({ total, lastPage, page, data })
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function getUserCreatedFeaturedCollections (id, page = 1) {
  if (page < 1) throw new Error('Argument `page` must more than or equal to 1')
  return new Promise((resolve, reject) => {
    http.get(`http://www.xiami.com/space/collect/u/${id}/page/${page}`, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const $ = cheerio.load(rawData)
        const total = parseInt($('.counts').text().match(/\d+/)[0])
        if (total === 0) {
          resolve(null)
          return
        }

        const data = []
        const lastPage = Math.ceil(total / MAX_USER_FAVORED_ALBUMS_PAGE_ITEMS)
        if (page > lastPage) {
          resolve(null)
          return
        }

        $('.collectThread_list > ul > li').each((_, element) => {
          const $element = $(element)
          const $cover = $element.find('.cover img')

          let coverURL = $cover.attr('src').replace(/@.*$/, '')
          coverURL = coverURL === 'http://pic.xiami.net/res/img/default/collect_default_cover.png' ? null : _URL.parse(coverURL)

          const title = $cover.attr('alt').trim()
          const id = parseInt($element.find('.name a').attr('href').match(/\d+/)[0])

          data.push({ id, title, coverURL })
        })

        resolve({ total, lastPage, page, data })
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function getUserFavoredArtists (id, page = 1) {
  if (page < 1) throw new Error('Argument `page` must more than or equal to 1')
  return new Promise((resolve, reject) => {
    http.get(`http://www.xiami.com/space/lib-artist/u/${id}/page/${page}`, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const $ = cheerio.load(rawData)
        const total = parseInt($('.counts').text().match(/\d+/)[0])
        if (total === 0) {
          resolve(null)
          return
        }

        const data = []
        const lastPage = Math.ceil(total / MAX_USER_FAVORED_ARTISTS_PAGE_ITEMS)
        if (page > lastPage) {
          resolve(null)
          return
        }

        $('.artistThread_list > ul > li').each((_, element) => {
          const $element = $(element)
          const $photo = $element.find('.artist100 > img')
          const $name = $element.find('.name > a > strong')

          let photoURL = $photo.attr('src').replace(/@.*$/, '')
          photoURL = photoURL === 'http://pic.xiami.net/res/img/default/cd100.gif' ? null : _URL.parse(photoURL)

          let id = $element.attr('id').match(/\d+/)
          if (id === null) {
            resolve(null)
            return
          }
          id = parseInt(id[0])

          const name = $name.clone().children().remove().end().text().trim()
          let aliases = $name.find('span').text().trim().match(/^\((.*)\)$/)
          aliases = aliases === null ? [] : aliases[1].split(' / ')

          data.push({ id, name, aliases, photoURL })
        })

        resolve({ total, lastPage, page, data })
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function getUserProfile (id) {
  return new Promise((resolve, reject) => {
    http.get(`http://www.xiami.com/u/${id}`, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const $ = cheerio.load(rawData)
        const name = $('h1').text().trim()

        let avatarURL = $('#p_buddy > img').attr('src').replace(/@.*$/, '')
        avatarURL = avatarURL.match(/\/\/pic\.xiami.net\/images\/default\/avatar/) !== null ? null : _URL.parse(avatarURL)

        const playCounts = parseInt($('.play_count').text().replace('累计播放歌曲：', '').trim())
        const introduction = _editorTextFormatToString($('.tweeting_full').text().trim())
        const registeredDate = new Date($('.gray').text().replace('加入', '').trim())

        resolve({ id, name, avatarURL, playCounts, introduction, registeredDate })
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function login (username, password) {
  return new Promise((resolve, reject) => {
    https.get('https://login.xiami.com/member/login', (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
      }

      const xiamiToken = res.headers['set-cookie'][1].match(/_xiamitoken=(\w+);/)[1]
      res.resume()

      const postData = querystring.stringify({
        '_xiamitoken': xiamiToken,
        'account': username,
        'pw': password
      })
      const options = {
        hostname: 'login.xiami.com',
        path: '/passport/login',
        method: 'POST',
        headers: {
          'Referer': 'https://login.xiami.com/member/login',
          'Cookie': `_xiamitoken=${xiamiToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }

      const req = https.request(options, (res) => {
        const { statusCode } = res

        let error
        if (statusCode !== 200) {
          error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
        }
        if (error) {
          res.resume()
          reject(error)
        }

        res.setEncoding('utf8')
        let rawData = ''
        res.on('data', (chunk) => { rawData += chunk })
        res.on('end', () => {
          const parsedData = JSON.parse(rawData)
          if (!parsedData.status) {
            reject(new Error(parsedData.msg))
            return
          }

          const id = parseInt(res.headers['set-cookie'][4].match(/user=(\d+)/)[1])
          const name = decodeURIComponent(res.headers['set-cookie'][4].match(/%22(.*?)%22/)[1])
          const userToken = res.headers['set-cookie'][3].match(/member_auth=(\w+);/)[1]
          resolve({
            id,
            name,
            userToken
          })
        })
      })

      req.on('error', (e) => {
        reject(e)
      })
      req.end(postData)
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function getDailyRecommendedTracklist (userToken = null) {
  return getTracklist(TRACKLIST_TYPE_DAILY_RECOMMENDED, 1, userToken)
}

function getRadioTracklist (type, id) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.xiami.com',
      path: `/radio/xml/type/${type}/id/${id}`
    }

    http.get(options, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        xml2js.parseString(rawData, (err, parsedData) => {
          if (err !== null) {
            reject(err)
            return
          }

          const tracklist = []
          if (parsedData === null) {
            resolve(tracklist)
            return
          }

          for (const songData of parsedData.playList.trackList[0].track) {
            const artists = []
            for (const name of songData.artist[0].split(';')) {
              artists.push({ id: songData.artist_id[0] === null ? null : parseInt(songData.artist_id[0]), name })
              songData.artist_id[0] = null
            }

            let albumId = parseInt(songData.album_id[0])
            albumId = albumId === 0 ? null : albumId

            let albumCoverURL = songData.pic[0]
            albumCoverURL = albumCoverURL.match(/\/\/img\.xiami.net\/images\/default\//) !== null ? null : _URL.parse(albumCoverURL)

            tracklist.push({
              id: parseInt(songData.song_id[0]),
              title: songData.title[0],
              album: {
                id: albumId,
                coverURL: albumCoverURL,
                title: songData.album_name[0]
              },
              artists,
              audioURL: _URL.parse(_decodeLocation(songData.location[0]))
            })
          }

          resolve(tracklist)
        })
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function getUserRadioTracklist (id) {
  return getRadioTracklist(RADIO_TRACKLIST_TYPE_USER, id)
}

function getArtistRadioTracklist (id) {
  return getRadioTracklist(RADIO_TRACKLIST_TYPE_ARTIST, id)
}

function searchSongs (keyword, page = 1) {
  if (page < 1) throw new Error('Argument `page` must more than or equal to 1')
  return new Promise((resolve, reject) => {
    http.get(`http://www.xiami.com/search/song/page/${page}?key=${encodeURIComponent(keyword)}`, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const $ = cheerio.load(rawData)

        const total = parseInt($('.seek_counts.ok > b:first-child').text().trim())
        if (total === 0) {
          resolve(null)
          return
        }

        const data = []
        const lastPage = Math.ceil(total / MAX_SEARCH_SONGS_PAGE_ITEMS)
        if (page > lastPage) {
          resolve(null)
          return
        }

        $('.track_list > tbody > tr').each((_, element) => {
          const $element = $(element)
          const $input = $element.find('input[type="checkbox"]')
          const $album = $element.find('.song_album > a')

          const id = parseInt($input.attr('value').trim())
          const canBePlayed = $input.is(':checked')
          const title = $element.find('.song_name > a[href^="http://www.xiami.com/song/"]').attr('title').trim()

          const artists = []
          $element.find('.song_artist > a').each((_, element) => {
            const $element = $(element)

            const id = $element.attr('href').match(/\w+$/)[0]
            const name = $element.text().trim()

            artists.push({ id, name })
          })

          const albumTitle = $album.text().match(/^《(.*)》$/)[1].trim()
          const albumSubtitle = $album.attr('title')

          const album = {
            id: $album.attr('href').match(/\w+$/)[0],
            title: albumTitle,
            subtitle: albumTitle === albumSubtitle ? null : albumSubtitle
          }

          data.push({ id, canBePlayed, title, artists, album })
        })

        resolve({ total, lastPage, page, data })
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function searchAlbums (keyword, page = 1, limit = 10) {
  if (page < 1) throw new Error('Argument `page` must more than or equal to 1')
  return new Promise((resolve, reject) => {
    http.get(`http://www.xiami.com/search/album/page/${page}?key=${encodeURIComponent(keyword)}`, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const $ = cheerio.load(rawData)

        let success = true
        const albumList = []
        const total = parseInt($('.seek_counts.ok > b:first-child').text().trim())
        if (total === 0) {
          resolve({ success, total, albumList })
          return
        }

        const lastPage = Math.ceil(total / MAX_SEARCH_ALBUMS_PAGE_ITEMS)

        if (page > lastPage) {
          resolve({ success, total, albumList })
          return
        }

        $('.albumBlock_list > ul > li').each((index, element) => {
          if (limit > index) {

            const $element = $(element)
            const $name = $element.find('.name > a[href^="http://www.xiami.com/album/"]')
            const $artist = $element.find('.singer')

            const id = $name.attr('href').match(/\w+$/)[0]
            

            const name = $name.attr('title')

            let subtitle = $name.find('.album_name').text().trim()
            subtitle = subtitle === '' ? null : subtitle.match(/^\((.*)\)$/)[1]

            let artist = {
              id: $artist.attr('href').match(/\w+$/)[0],
              name: $artist.attr('title').trim()
            }
            artist = artist.name === '' ? null : artist

            let cover = $element.find('.cover img').attr('src').replace(/@.*$/, '')
            cover = cover.match(/\/\/pic\.xiami.net\/images\/default\//) !== null ? null : _URL.parse(cover)

            cover = cover.href + '@1e_1c_100Q_200w_200h'

            albumList.push({ id, name, subtitle, artist, cover })
          }
        })


        if (!albumList[0]) {
          console.log('keyword')
        }

        // 暂时只取获取并替换一个结果的 id
        getAlbumIdByUrl(`http://www.xiami.com/album/${albumList[0].id}`).then(res => {
          if (!res || !res.id) {
            console.log(`album id - ${albumList[0].id}, res = ${res}`)
          }
          albumList[0].id = res.id

          resolve({ success, total, albumList })
        }).catch((e) => {
          reject(e)
        })

      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function searchFeaturedCollections (keyword, page = 1) {
  if (page < 1) throw new Error('Argument `page` must more than or equal to 1')
  return new Promise((resolve, reject) => {
    http.get(`http://www.xiami.com/search/collect/page/${page}?key=${encodeURIComponent(keyword)}`, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const $ = cheerio.load(rawData)

        const total = parseInt($('.cs_t > i').text().trim())
        if (total === 0) {
          resolve(null)
          return
        }

        const data = []
        const lastPage = Math.ceil(total / MAX_SEARCH_FEATURED_COLLECTIONS_PAGE_ITEMS)
        if (page > lastPage) {
          resolve(null)
          return
        }

        $('.block_list > ul > li').each((_, element) => {
          const $element = $(element)
          const $title = $element.find('h3 > a')
          const $author = $element.find('.collect_info a[href^="http://www.xiami.com/u/"]')

          const id = parseInt($title.attr('href').match(/\d+$/)[0])
          const title = $title.attr('title')

          const author = {
            id: parseInt($author.attr('href').match(/\d+$/)[0]),
            name: $author.attr('title').trim()
          }

          let coverURL = $('.block_cover img').attr('src').replace(/@.*$/, '')
          coverURL = coverURL === 'http://pic.xiami.net/res/img/default/collect_default_cover.png' ? null : _URL.parse(coverURL)

          data.push({ id, title, author, coverURL })
        })

        resolve({ total, lastPage, page, data })
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function addUserFavorite (id, type, userToken) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      type,
      id,
      '_xiamitoken': 1
    })

    const options = {
      method: 'POST',
      hostname: 'www.xiami.com',
      path: '/ajax/addtag',
      headers: {
        'Cookie': `member_auth=${userToken}; _xiamitoken=1`,
        'Referer': 'http://www.xiami.com/',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }

    const req = http.request(options, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const parsedData = JSON.parse(rawData)
        if (parsedData.status !== 'ok' && parsedData.msg !== '以前收藏过了') {
          reject(new Error(`Add favorite failed (reason: ${parsedData.msg})`))
          return
        }
        resolve()
      })
    })

    req.on('error', (e) => {
      reject(e)
    })

    req.end(postData)
  })
}

function deleteUserFavorite (id, type, userToken) {
  return new Promise((resolve, reject) => {
    let queryType = null
    switch (type) {
      case FAVORITE_TYPE_ALBUM:
        queryType = 'album_id'
        break
      case FAVORITE_TYPE_ARTIST:
        queryType = 'artist_id'
        break
      case FAVORITE_TYPE_FEATURED_COLLECTION:
        queryType = 'list_id'
        break
      case FAVORITE_TYPE_SONG:
        queryType = 'song_id'
        break
      default:
        reject(new Error('Unknown favorite `type`'))
        return
    }

    const options = {
      hostname: 'www.xiami.com',
      path: `/ajax/${type === FAVORITE_TYPE_FEATURED_COLLECTION ? 'collect-fav-del' : 'space-lib-del'}?${queryType}=${id}&_xiamitoken=1`,
      headers: {
        'Cookie': `member_auth=${userToken}; _xiamitoken=1`,
        'Referer': 'http://www.xiami.com/'
      }
    }

    http.get(options, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const parsedData = JSON.parse(rawData)
        if (parsedData.code !== 1) {
          reject(new Error('Delete favorite failed'))
          return
        }
        resolve()
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

function addAlbumToUserFavorite (id, userToken) {
  return addUserFavorite(id, FAVORITE_TYPE_ALBUM, userToken)
}

function deleteAlbumFromUserFavorite (id, userToken) {
  return deleteUserFavorite(id, FAVORITE_TYPE_ALBUM, userToken)
}

function addSongToUserFavorite (id, userToken) {
  return addUserFavorite(id, FAVORITE_TYPE_SONG, userToken)
}

function deleteSongFromUserFavorite (id, userToken) {
  return deleteUserFavorite(id, FAVORITE_TYPE_SONG, userToken)
}

function addArtistToUserFavorite (id, userToken) {
  return addUserFavorite(id, FAVORITE_TYPE_ARTIST, userToken)
}

function deleteArtistFromUserFavorite (id, userToken) {
  return deleteUserFavorite(id, FAVORITE_TYPE_ARTIST, userToken)
}

function addFeaturedCollectionToUserFavorite (id, userToken) {
  return addUserFavorite(id, FAVORITE_TYPE_FEATURED_COLLECTION, userToken)
}

function deleteFeaturedCollectionFromUserFavorite (id, userToken) {
  return deleteUserFavorite(id, FAVORITE_TYPE_FEATURED_COLLECTION, userToken)
}

function getAlbumIdByUrl(albumUrl) {
  if (!albumUrl) throw new Error('缺少 albumUrl 参数')
  return new Promise((resolve, reject) => {
    http.get(albumUrl, (res) => {
      const { statusCode } = res

      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`)
      }
      if (error) {
        res.resume()
        reject(error)
        return
      }

      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        const $ = cheerio.load(rawData)
        const id = $('link[rel="canonical"]').attr('href').replace('http://www.xiami.com/album/', '')

        resolve({ id })
      })
    }).on('error', (e) => {
      reject(e)
    })
  })
}

module.exports = {
  getFeaturedCollectionContent,
  getArtistIdByName,
  getArtistIdBySearch,
  getArtistIdByNameOrSearch,
  getArtistProfile,
  getArtistAlbums,
  getArtistTop100Songs,
  getAlbumContent,
  getSongContent,
  getSongHQAudioURL,
  getTracklist,
  getSongsTracklist,
  getArtistTracklist,
  getAlbumTracklist,
  getFeaturedCollectionTracklist,
  getDailyRecommendedTracklist,
  getUserFavoredSongs,
  getUserFavoredAlbums,
  getUserFavoredArtists,
  getUserFavoredFeaturedCollections,
  getUserCreatedFeaturedCollections,
  getUserProfile,
  login,
  getRadioTracklist,
  getUserRadioTracklist,
  getArtistRadioTracklist,
  convertArtistStringIdToNumberId,
  searchArtists,
  searchSongs,
  searchAlbums,
  searchFeaturedCollections,
  addUserFavorite,
  deleteUserFavorite,
  addAlbumToUserFavorite,
  deleteAlbumFromUserFavorite,
  addSongToUserFavorite,
  deleteSongFromUserFavorite,
  addArtistToUserFavorite,
  deleteArtistFromUserFavorite,
  addFeaturedCollectionToUserFavorite,
  deleteFeaturedCollectionFromUserFavorite,
  FAVORITE_TYPE_SONG,
  FAVORITE_TYPE_ALBUM,
  FAVORITE_TYPE_FEATURED_COLLECTION,
  FAVORITE_TYPE_ARTIST,
  MAX_SEARCH_ARTISTS_PAGE_ITEMS,
  MAX_SEARCH_SONGS_PAGE_ITEMS,
  MAX_SEARCH_ALBUMS_PAGE_ITEMS,
  MAX_SEARCH_FEATURED_COLLECTIONS_PAGE_ITEMS,
  MAX_ARTIST_ALBUMS_PAGE_ITEMS,
  MAX_ARTIST_TOP100_PAGE_ITEMS,
  MAX_USER_FAVORED_SONGS_PAGE_ITEMS,
  MAX_USER_FAVORED_ALBUMS_PAGE_ITEMS,
  MAX_USER_FAVORED_ARTISTS_PAGE_ITEMS,
  TRACKLIST_TYPE_SONG,
  TRACKLIST_TYPE_ALBUM,
  TRACKLIST_TYPE_ARTIST,
  TRACKLIST_TYPE_FEATURED_COLLECTION,
  TRACKLIST_TYPE_DAILY_RECOMMENDED,
  RADIO_TRACKLIST_TYPE_USER,
  RADIO_TRACKLIST_TYPE_ARTIST
}
