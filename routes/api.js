const router = require('express').Router()
const XIAMIAPI = require('./../utils/xiami-api')

const isXiamiSong = /(http(s)?:\/\/)?(www\.)?xiami.com\/(song\/[\w-./?%&=]*)$/


router.get('/', (req, res, next) => {
  const pageUrl = req.query.url

  if (!pageUrl || !isXiamiSong.test(pageUrl)) {
    res.jsonp({
      'success': false,
      'url': null,
      'message':'url 有误，应为：https://www.xiami.com/song/xxxx 格式'
    })
    return
  }

  const songMid = pageUrl.split('song/')[1].split('?')[0]

  // console.log('songMid = ', songMid)

  XIAMIAPI.Song.getContent(songMid).then((data) => {
    // console.log(data)
    res.jsonp(data)
  }).catch(err => {
    console.error(err)
    res.jsonp({
      success: false,
      message: '获取失败'
    })
  })
})

module.exports = router
