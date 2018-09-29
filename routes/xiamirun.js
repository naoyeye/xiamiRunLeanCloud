/*
* @Author: naoyeye
* @Date:   2018-03-16 14:07:25
* @Last Modified by:   hanjiyun
* @Last Modified time: 2018-09-29 16:28:24
*/
'use strict';
const router = require('express').Router()

const XIAMI = require('./../utils/song')
const https = require('https')
const url = require('url')

const isXiamiSong = /(http(s)?:\/\/)?(www\.)?xiami.com\/(song\/[\w-./?%&=]*)?$/

router.get('/', (req, res, next) => {
  res.render('index', {
    "result": null
  })
})

router.post('/', (req, res, next) => {

  const pageUrl = req.body.url

  if (!pageUrl || !isXiamiSong.test(pageUrl)) {
    res.render('index', {
      'result': {
        'success': false,
        'url': null,
        'message':'url 有误，应为：https://www.xiami.com/song/xxxx 格式'
      }
    })
  }

  const songMid = pageUrl.split('song/')[1].split('?')[0]
  
  XIAMI.Song.getContent(songMid).then((data) => {
    const songId = data.id
    const title = data.title
    let artists = ''
    const coverURL = data.album.coverURL.href
    const albumTitle = data.album.title

    data.artists.map((artistItem) => {
      artists = artists + artistItem.name
    })

    // 第三方服务
    const doutingFactory = url.parse(`https://douting.leanapp.cn/api/get/song/xiami?id=${songId}`)

    https.get(doutingFactory, (resp) => {
      resp.setEncoding('utf8')
      let json = ''

      resp.on('data', (req) => {
        if (req.status === 1) {
          res.jsonp({
            'success': false,
            'url': null,
            'message':'解析失败'
          })
          return
        }

        json += req
        json = JSON.parse(json)

        if (!json.success || !json.url) {
          json.message = '获取失败';
        } else {
          json.message = '获取成功';
          json.title = title;
          json.artists = artists;
          json.albumTitle = albumTitle
          json.coverURL = coverURL
        }

        res.render('index', {
          'result': json,
        })

      })
    })


    // XIAMI.Song.getHQAudioURL(songId).then((data) => {
    //   let _data = data;

    //   if (!data.success || !data.url) {
    //     _data.message = '获取失败';
    //   } else {
    //     _data.message = '获取成功';
    //     _data.title = title;
    //     _data.artists = artists;
    //   }
    //    res.render('index', {
    //     'result': _data,

    //   });
    //   // res.jsonp(_data);
    // });
  })

});


module.exports = router;
